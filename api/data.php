<?php
// ===== LboCraft API — CMS Data =====
// حفظ/قراءة بيانات الموقع (مقالات، روابط، إعدادات)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Passcode');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ===== CONFIG =====
$PASSCODE   = '0099';  // غيّر الرمز هنا
$STORAGE    = __DIR__ . '/data/cms.json';
$MAX_SIZE   = 512000;  // 500KB max

// ===== ENSURE DATA DIR =====
if (!is_dir(__DIR__ . '/data')) { mkdir(__DIR__ . '/data', 0755, true); }

// ===== DEFAULT DATA =====
function defaultData() {
    return [
        'pages' => [],
        'blog' => [
            ['id'=>1, 'title'=>'كيف تبني استراتيجية تسويق رقمي فعّالة في 2026', 'excerpt'=>'الدليل الشامل لبناء استراتيجية تسويقية تحقق نتائج ملموسة.', 'category'=>'استراتيجية', 'date'=>'2026-07-10', 'content'=>'التسويق الرقمي في 2026 يتطلب نهجاً استراتيجياً شاملاً...'],
            ['id'=>2, 'title'=>'أسرار تصميم المواقع الإلكترونية', 'excerpt'=>'كيف يُصمَّم موقع إلكتروني أداة تحويل فعلية.', 'category'=>'تصميم مواقع', 'date'=>'2026-07-05', 'content'=>'تصميم الموقع الإلكتروني هو البوابة الأولى...'],
            ['id'=>3, 'title'=>'إدارة حملات جوجل إعلانات', 'excerpt'=>'استراتيجيات متقدمة لتحقيق أعلى عائد إعلاني.', 'category'=>'إعلانات جوجل', 'date'=>'2026-06-28', 'content'=>'الإعلانات على جوجل ليست مجرد ضغط على زر...']
        ],
        'social' => ['whatsapp'=>'', 'instagram'=>'', 'tiktok'=>'', 'snapchat'=>'', 'facebook'=>''],
        'contact_info' => ['email'=>'info@darbalnajah.com', 'phone'=>'', 'location'=>'الرياض، السعودية']
    ];
}

// ===== READ =====
function readData() {
    global $STORAGE;
    if (!file_exists($STORAGE)) return defaultData();
    $raw = file_get_contents($STORAGE);
    $data = json_decode($raw, true);
    return $data ?: defaultData();
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
