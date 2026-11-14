<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

/** GET ?game=&board=&limit= -> skor terbaik tiap pemain, diurutkan */
$game = (string)($_GET['game'] ?? ''); $g = valid_game($game);
$board = (string)($_GET['board'] ?? '');
if (!isset($g['boards'][$board])) fail('Papan skor tidak dikenal');
$dir = $g['boards'][$board] === 'asc' ? 'ASC' : 'DESC';
$limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));
$me = current_user();
$sql = "SELECT user_id, value, meta, created_at FROM (
          SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.value $dir, s.created_at ASC) AS rn
          FROM scores s WHERE s.game=? AND s.board=?
        ) WHERE rn=1 ORDER BY value $dir, created_at ASC LIMIT ?";
$st = db()->prepare($sql); $st->execute([$game, $board, $limit]);
$rows = $st->fetchAll();
$names = [];
if ($rows) {
  $ids = array_unique(array_map(fn($r) => (int)$r['user_id'], $rows));
  $q = db()->prepare('SELECT id, display_name FROM users WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
  $q->execute(array_values($ids));
  foreach ($q->fetchAll() as $r) $names[(int)$r['id']] = $r['display_name'];
}
$out = [];
foreach ($rows as $i => $r) {
  $out[] = ['rank' => $i + 1, 'name' => $names[(int)$r['user_id']] ?? '?', 'value' => (float)$r['value'],
            'meta' => $r['meta'] ? json_decode($r['meta'], true) : null, 'at' => (int)$r['created_at'],
            'me' => $me && (int)$r['user_id'] === $me['id']];
}
json_out(['ok' => true, 'game' => $game, 'board' => $board, 'rows' => $out]);
