<?php
declare(strict_types=1);
/**
 * Game Hub API bootstrap: koneksi SQLite, sesi, helper JSON, rate limit.
 * Semua endpoint meng-include file ini di baris pertama.
 */
const HUB_SESSION_COOKIE = 'hub_sid';
const HUB_SESSION_DAYS   = 90;
const HUB_SAVE_MAX_BYTES = 65536;

/** Daftar game dan papan skornya. 'asc' = nilai kecil lebih baik. */
const HUB_GAMES = [
  'clickgame' => ['name' => 'Click Upgrade', 'boards' => ['time' => 'asc', 'gold' => 'asc', 'ta' => 'desc']],
];

$HUB_DATA_DIR = getenv('HUB_DATA_DIR') ?: dirname(__DIR__, 2) . '/data';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function json_out($data, int $code = 200): never {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail(string $msg, int $code = 400): never { json_out(['ok' => false, 'error' => $msg], $code); }

function json_in(): array {
  $raw = file_get_contents('php://input') ?: '';
  if ($raw === '') return [];
  $d = json_decode($raw, true);
  if (!is_array($d)) fail('JSON tidak valid');
  return $d;
}

/** Tolak POST lintas situs: wajib header kustom (browser tidak bisa kirim ini dari form biasa). */
function require_mutation(): void {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method harus POST', 405);
  if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'hub') fail('Header X-Requested-With wajib', 403);
}

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  global $HUB_DATA_DIR;
  if (!is_dir($HUB_DATA_DIR)) @mkdir($HUB_DATA_DIR, 0770, true);
  $file = $HUB_DATA_DIR . '/hub.sqlite';
  $fresh = !file_exists($file);
  $pdo = new PDO('sqlite:' . $file, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA journal_mode=WAL');
  $pdo->exec('PRAGMA foreign_keys=ON');
  $pdo->exec('PRAGMA busy_timeout=3000');
  if ($fresh || !$pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")->fetch()) {
    $pdo->exec(file_get_contents(dirname(__DIR__, 2) . '/schema.sql'));
  }
  return $pdo;
}

function client_ip(): string {
  // Di belakang Cloudflare pakai CF-Connecting-IP; Caddy meneruskannya apa adanya.
  return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/** Rate limit sederhana: maksimal $max kejadian per $windowSec untuk satu bucket. */
function rate_limit(string $bucket, int $max, int $windowSec): void {
  $pdo = db(); $now = time();
  $pdo->prepare('DELETE FROM rate_limit WHERE ts < ?')->execute([$now - $windowSec]);
  $st = $pdo->prepare('SELECT COUNT(*) FROM rate_limit WHERE bucket=? AND ts>=?');
  $st->execute([$bucket, $now - $windowSec]);
  if ((int)$st->fetchColumn() >= $max) fail('Terlalu banyak percobaan, coba lagi nanti', 429);
  $pdo->prepare('INSERT INTO rate_limit(bucket, ts) VALUES(?,?)')->execute([$bucket, $now]);
}

function is_https(): bool {
  return (($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function set_session(int $userId): void {
  $token = bin2hex(random_bytes(32));
  $now = time(); $exp = $now + HUB_SESSION_DAYS * 86400;
  db()->prepare('INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES(?,?,?,?)')
      ->execute([hash('sha256', $token), $userId, $now, $exp]);
  setcookie(HUB_SESSION_COOKIE, $token, [
    'expires' => $exp, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => is_https(),
  ]);
}

function clear_session(): void {
  $token = $_COOKIE[HUB_SESSION_COOKIE] ?? '';
  if ($token !== '') db()->prepare('DELETE FROM sessions WHERE token_hash=?')->execute([hash('sha256', $token)]);
  setcookie(HUB_SESSION_COOKIE, '', ['expires' => 1, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => is_https()]);
}

/** Pengguna yang sedang login, atau null. */
function current_user(): ?array {
  static $cached = false;
  if ($cached !== false) return $cached;
  $token = $_COOKIE[HUB_SESSION_COOKIE] ?? '';
  if ($token === '') return $cached = null;
  $st = db()->prepare('SELECT u.id, u.username, u.display_name, u.is_guest, u.created_at
                       FROM sessions s JOIN users u ON u.id = s.user_id
                       WHERE s.token_hash=? AND s.expires_at > ?');
  $st->execute([hash('sha256', $token), time()]);
  $u = $st->fetch() ?: null;
  if ($u) {
    $u['id'] = (int)$u['id']; $u['is_guest'] = (bool)$u['is_guest'];
    db()->prepare('UPDATE users SET last_seen=? WHERE id=?')->execute([time(), $u['id']]);
  }
  return $cached = $u;
}

function require_user(): array {
  $u = current_user();
  if (!$u) fail('Belum login', 401);
  return $u;
}

function public_user(array $u): array {
  return ['id' => $u['id'], 'username' => $u['username'], 'name' => $u['display_name'], 'guest' => (bool)$u['is_guest']];
}

function valid_game(string $g): array {
  if (!isset(HUB_GAMES[$g])) fail('Game tidak dikenal');
  return HUB_GAMES[$g];
}
