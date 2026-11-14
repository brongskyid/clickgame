<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

/** POST {game, board, value, meta?} */
require_mutation();
$u = require_user();
rate_limit("score:{$u['id']}", 60, 3600);
$in = json_in();
$game = (string)($in['game'] ?? ''); $g = valid_game($game);
$board = (string)($in['board'] ?? '');
if (!isset($g['boards'][$board])) fail('Papan skor tidak dikenal');
if (!isset($in['value']) || !is_numeric($in['value'])) fail('value harus angka');
$value = (float)$in['value'];
if (!is_finite($value) || $value < 0 || $value > 1e15) fail('value di luar batas');
$meta = isset($in['meta']) && is_array($in['meta']) ? json_encode(array_slice($in['meta'], 0, 12), JSON_UNESCAPED_UNICODE) : null;
if ($meta !== null && strlen($meta) > 1024) fail('meta terlalu besar');
db()->prepare('INSERT INTO scores(user_id, game, board, value, meta, created_at) VALUES(?,?,?,?,?,?)')
    ->execute([$u['id'], $game, $board, $value, $meta, time()]);
json_out(['ok' => true]);
