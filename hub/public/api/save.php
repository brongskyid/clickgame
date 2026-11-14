<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

/** GET ?game=  -> {data, updated_at} ; POST {game, data} -> simpan */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $u = require_user();
  $game = (string)($_GET['game'] ?? ''); valid_game($game);
  $st = db()->prepare('SELECT data, updated_at FROM saves WHERE user_id=? AND game=?');
  $st->execute([$u['id'], $game]);
  $row = $st->fetch();
  json_out(['ok' => true, 'data' => $row ? json_decode($row['data'], true) : null, 'updated_at' => $row ? (int)$row['updated_at'] : null]);
}
require_mutation();
$u = require_user();
$in = json_in();
$game = (string)($in['game'] ?? ''); valid_game($game);
if (!isset($in['data']) || !is_array($in['data'])) fail('data harus objek');
$json = json_encode($in['data'], JSON_UNESCAPED_UNICODE);
if (strlen($json) > HUB_SAVE_MAX_BYTES) fail('Data terlalu besar', 413);
$now = time();
db()->prepare('INSERT INTO saves(user_id, game, data, updated_at) VALUES(?,?,?,?)
               ON CONFLICT(user_id, game) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
    ->execute([$u['id'], $game, $json, $now]);
json_out(['ok' => true, 'updated_at' => $now]);
