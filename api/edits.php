<?php
// ===== LboCraft API — Page Edits =====
// حفظ/قراءة تعديلات الصفحة (HTML snapshots)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Passcode');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ===== CONFIG =====
$PASSCODE   = '0099';  // غيّر الرمز هنا
$STORAGE    = __DIR__ . '/data/edits.json';
$MAX_SIZE   = 2097152; // 2MB max for page edits

// ===== ENSURE DATA DIR =====
if (!is_dir(__DIR__ . '/data')) { mkdir(__DIR__ . '/data', 0755, true); }

// ===== READ =====
function readData() {
    global $STORAGE;
    if (!file_exists($STORAGE)) return [];
    $raw = file_get_contents($STORAGE);
    $data = json_decode($raw, true);
    return $data ?: [];
}

// ===== WRITE =====
function writeData($data) {
    global $STORAGE, $MAX_SIZE;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if (strlen($json) > $MAX_SIZE) {
        http_response_code(413);
        echo json_encode(['error' => 'البيانات كبيرة جداً']);
        exit;
    }
    file_put_contents($STORAGE, $json, LOCK_EX);
}

// ===== HANDLE REQUEST =====
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(readData());
    exit;
}

if ($method === 'POST') {
    $passcode = $_SERVER['HTTP_X_PASSCODE'] ?? '';
    if ($passcode !== $PASSCODE) {
        http_response_code(403);
        echo json_encode(['error' => 'رمز المرور غير صحيح']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'بيانات غير صحيحة']);
        exit;
    }

    writeData($input);
    echo json_encode(['ok' => true, 'message' => 'تم الحفظ']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
