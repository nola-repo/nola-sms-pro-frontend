<?php

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: X-Webhook-Secret, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . '/config.php';
require __DIR__ . '/firestore_client.php';
require __DIR__ . '/../auth_helpers.php';

$SEMAPHORE_API_KEY = $config['SEMAPHORE_API_KEY'];
$SEMAPHORE_URL = $config['SEMAPHORE_URL'];
$SENDER_IDS = $config['SENDER_IDS'];

validate_api_request();

/* |-------------------------------------------------------------------------- | BASIC LOGGER |-------------------------------------------------------------------------- */
function log_sms($label, $data)
{
    error_log("[" . date('Y-m-d H:i:s') . "] $label: " . json_encode($data));
}

/* |-------------------------------------------------------------------------- | FULL PAYLOAD LOGGER |-------------------------------------------------------------------------- */
function log_full_payload($raw, $payload)
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $debug = [
        "timestamp" => date('Y-m-d H:i:s'),
        "method" => $_SERVER['REQUEST_METHOD'] ?? null,
        "uri" => $_SERVER['REQUEST_URI'] ?? null,
        "headers" => $headers,
        "raw_body" => $raw,
        "json_decoded_payload" => $payload,
        "post_data" => $_POST,
        "get_data" => $_GET
    ];
    error_log("[FULL_PAYLOAD] " . json_encode($debug));
    $payloadFile = sys_get_temp_dir() . '/last_payload_debug.json';
    file_put_contents($payloadFile, json_encode($debug, JSON_PRETTY_PRINT));
}

/* |-------------------------------------------------------------------------- | CLEAN PH NUMBERS |-------------------------------------------------------------------------- */
function clean_numbers($numberString): array
{
    if (!$numberString)
        return [];
    $numbers = is_array($numberString) ? $numberString : preg_split('/[,;]/', $numberString);
    $valid = [];
    foreach ($numbers as $num) {
        $num = trim($num);
        $num = preg_replace('/[^0-9+]/', '', $num);
        $digits = ltrim($num, '+');
        if (preg_match('/^09\d{9}$/', $digits)) {
            $normalized = $digits;
        }
        elseif (preg_match('/^9\d{9}$/', $digits)) {
            $normalized = '0' . $digits;
        }
        elseif (preg_match('/^639\d{9}$/', $digits)) {
            $normalized = '0' . substr($digits, 2);
        }
        elseif (preg_match('/^63(9\d{9})$/', $digits, $m)) {
            $normalized = '0' . $m[1];
        }
        else {
            $normalized = null;
        }
        if ($normalized) {
            $valid[$normalized] = true;
        }
    }
    return array_keys($valid);
}

/* |-------------------------------------------------------------------------- | DEBUG VIEW |-------------------------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $file = sys_get_temp_dir() . '/last_payload_debug.json';
    if (file_exists($file)) {
        echo file_get_contents($file);
    }
    else {
        echo json_encode(["status" => "empty"]);
    }
    exit;
}

/* |-------------------------------------------------------------------------- | RECEIVE PAYLOAD |-------------------------------------------------------------------------- */
$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    $payload = $_POST;
}
log_full_payload($raw, $payload);

/* |-------------------------------------------------------------------------- | EXTRACT MESSAGE + SENDER |-------------------------------------------------------------------------- */
$customData = $payload['customData'] ?? [];
$data = $payload['data'] ?? [];

$message = $customData['message'] ?? $payload['message'] ?? $data['message'] ?? '';
if ($message) {
    if (strpos($message, '<') !== false) {
        $message = strip_tags($message);
    }
    $message = html_entity_decode($message);
    $message = preg_replace('/\s+/', ' ', $message);
    $message = trim($message);
}
log_sms("MESSAGE_CLEANED", $message);

$sender = $customData['sendername'] ?? $payload['sendername'] ?? $data['sendername'] ?? ($SENDER_IDS[0] ?? "");
$batch_id = $customData['batch_id'] ?? null;
$contact_name = $customData['name'] ?? ($payload['contact']['name'] ?? null);
$recipient_key = $customData['recipient_key'] ?? null;

/* |-------------------------------------------------------------------------- | EXTRACT PHONE NUMBER |-------------------------------------------------------------------------- */
$number_input = $customData['number'] ?? $customData['phone'] ?? $payload['number'] ?? $payload['phone'] ?? $payload['phoneNumber'] ?? ($data['phone'] ?? ($data['Phone'] ?? ($data['number'] ?? ($data['mobile'] ?? ($payload['contact']['phone'] ?? ($payload['contact']['phoneNumber'] ?? ($payload['contact']['mobile'] ?? null)))))));
log_sms("NUMBER_INPUT_RAW", $number_input);

$validNumbers = clean_numbers($number_input);
log_sms("NUMBER_AFTER_CLEAN", $validNumbers);

if (empty($validNumbers)) {
    echo json_encode(["status" => "error", "message" => "No valid PH numbers", "received" => $number_input]);
    exit;
}
if (!$message) {
    echo json_encode(["status" => "error", "message" => "Message empty"]);
    exit;
}
if (!in_array($sender, $SENDER_IDS)) {
    $sender = $SENDER_IDS[0];
}

/* |-------------------------------------------------------------------------- | SEND SMS |-------------------------------------------------------------------------- */
$sms_data = [
    "apikey" => $SEMAPHORE_API_KEY,
    "number" => implode(',', $validNumbers),
    "message" => $message,
    "sendername" => $sender
];
log_sms("SEMAPHORE_REQUEST", $sms_data);

$ch = curl_init($SEMAPHORE_URL);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($sms_data));

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$result = json_decode($response, true);
log_sms("SEMAPHORE_RESPONSE", $result);

/* |-------------------------------------------------------------------------- | SAVE FIRESTORE |-------------------------------------------------------------------------- */
if ($status == 200 && is_array($result)) {
    $db = get_firestore();
    $now = new \DateTime();
    $ts = new \Google\Cloud\Core\Timestamp($now);

    // Support both array response and single message object response
    $messages_results = isset($result[0]) ? $result : [$result];

    foreach ($messages_results as $index => $msg) {
        if (!isset($msg['message_id']))
            continue;

        // Track specific recipient for each message in the response if multiple
        $recipient = $msg['number'] ?? ($validNumbers[$index] ?? $validNumbers[0]);

        $db->collection('messages')
            ->document($msg['message_id'])
            ->set([
            'number' => $recipient,
            'numbers' => [$recipient],
            'message' => $message,
            'sender_id' => $sender,
            'direction' => 'outbound',
            'status' => $msg['status'] ?? 'sent',
            'date_created' => $ts, // Standardized key name
            'batch_id' => $batch_id,
            'name' => $contact_name,
            'recipient_key' => $recipient_key,
            'source' => 'api'
        ], ['merge' => true]);

        // Also save to legacy sms_logs for backward compatibility
        $db->collection('sms_logs')
            ->document($msg['message_id'])
            ->set([
            'number' => $recipient,
            'message' => $message,
            'sender_id' => $sender,
            'direction' => 'outbound',
            'status' => $msg['status'] ?? 'sent',
            'date_created' => $ts,
            'batch_id' => $batch_id,
            'recipient_key' => $recipient_key
        ], ['merge' => true]);
    }
}

/* |-------------------------------------------------------------------------- | RESPONSE |-------------------------------------------------------------------------- */
echo json_encode([
    "status" => $status == 200 ? "success" : "failed",
    "numbers" => $validNumbers,
    "message" => $message,
    "sender" => $sender,
    "batch_id" => $batch_id,
    "response" => $result
]);
