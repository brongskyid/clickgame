<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
json_out(['ok' => true, 'time' => time(), 'games' => array_keys(HUB_GAMES)]);
