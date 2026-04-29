<?php
/**
 * OAuth Debug Tool — shows credentials AND tests GHL token exchange.
 * DEPLOY, USE, DELETE. Never leave this in production.
 *
 * Usage:
 *  - Check env vars: /oauth_debug.php?key=nola_debug_2026
 *  - Check callback log: /oauth_debug.php?key=nola_debug_2026&show_log=1
 */
if (($_GET['key'] ?? '') !== 'nola_debug_2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

header('Content-Type: application/json');

function mask(string $val): string {
    if (strlen($val) <= 8) return str_repeat('*', strlen($val));
    return substr($val, 0, 6) . '...' . substr($val, -4);
}

$ghlClientId     = getenv('GHL_CLIENT_ID')            ?: '6999da2b8f278296d95f7274-mmn30t4f';
$ghlClientSecret = getenv('GHL_CLIENT_SECRET')         ?: 'd91017ad-f4eb-461f-8967-b1d51cd1c1eb';
$agencyClientId  = getenv('GHL_AGENCY_CLIENT_ID')      ?: '69d31f33b3071b25dbcc5656-mnqxvtt3';
$agencySecret    = getenv('GHL_AGENCY_CLIENT_SECRET')  ?: '64b90a28-8cb1-4a44-8212-0a8f3f255322';

$expectedSubaccount = '6999da2b8f278296d95f7274-mmn30t4f';
$expectedAgency     = '69d31f33b3071b25dbcc5656-mnqxvtt3';

$host        = $_SERVER['HTTP_HOST'] ?? '(unknown)';
$redirectUri = 'https://' . $host . '/oauth/callback';

// If a real code is passed, test the subaccount exchange directly
$testResult = null;
if (!empty($_GET['code'])) {
    $testCode = $_GET['code'];
    $ch = curl_init('https://services.leadconnectorhq.com/oauth/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'client_id'     => $ghlClientId,
        'client_secret' => $ghlClientSecret,
        'grant_type'    => 'authorization_code',
        'code'          => $testCode,
        'user_type'     => 'Location',
        'redirect_uri'  => $redirectUri,
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'Version: 2021-07-28']);
    $testResponse = curl_exec($ch);
    $testHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $testResult = [
        'http_code' => $testHttpCode,
        'response'  => json_decode($testResponse, true) ?? $testResponse,
        'redirect_uri_used' => $redirectUri,
        'client_id_used'    => $ghlClientId,
    ];
}

echo json_encode([
    'host'         => $host,
    'redirect_uri' => $redirectUri,
    'subaccount_app' => [
        'client_id'         => $ghlClientId,
        'client_id_correct' => ($ghlClientId === $expectedSubaccount),
        'secret_masked'     => mask($ghlClientSecret),
    ],
    'agency_app' => [
        'client_id'         => $agencyClientId,
        'client_id_correct' => ($agencyClientId === $expectedAgency),
    ],
    'env_vars_raw' => [
        'GHL_CLIENT_ID_from_env'        => getenv('GHL_CLIENT_ID') ?: '(not set — using fallback)',
        'GHL_AGENCY_CLIENT_ID_from_env' => getenv('GHL_AGENCY_CLIENT_ID') ?: '(not set — using fallback)',
    ],
    'live_exchange_test' => $testResult ?? '(no code param provided — add &code=GHL_CODE to test)',
], JSON_PRETTY_PRINT);


// Only allow if a debug key is passed
if (($_GET['key'] ?? '') !== 'nola_debug_2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

header('Content-Type: application/json');

function mask(string $val): string {
    if (strlen($val) <= 8) return str_repeat('*', strlen($val));
    return substr($val, 0, 6) . '...' . substr($val, -4);
}

$ghlClientId     = getenv('GHL_CLIENT_ID')            ?: '6999da2b8f278296d95f7274-mmn30t4f';
$ghlClientSecret = getenv('GHL_CLIENT_SECRET')         ?: 'd91017ad-f4eb-461f-8967-b1d51cd1c1eb';
$agencyClientId  = getenv('GHL_AGENCY_CLIENT_ID')      ?: '69d31f33b3071b25dbcc5656-mnqxvtt3';
$agencySecret    = getenv('GHL_AGENCY_CLIENT_SECRET')  ?: '64b90a28-8cb1-4a44-8212-0a8f3f255322';

$expectedSubaccount = '6999da2b8f278296d95f7274-mmn30t4f';
$expectedAgency     = '69d31f33b3071b25dbcc5656-mnqxvtt3';

$host        = $_SERVER['HTTP_HOST'] ?? '(unknown)';
$redirectUri = 'https://' . $host . '/oauth/callback';

echo json_encode([
    'host'         => $host,
    'redirect_uri' => $redirectUri,
    'subaccount_app' => [
        'client_id'         => $ghlClientId,
        'client_id_masked'  => mask($ghlClientId),
        'client_id_correct' => ($ghlClientId === $expectedSubaccount),
        'secret_set'        => !empty($ghlClientSecret),
        'secret_masked'     => mask($ghlClientSecret),
    ],
    'agency_app' => [
        'client_id'         => $agencyClientId,
        'client_id_correct' => ($agencyClientId === $expectedAgency),
        'secret_set'        => !empty($agencySecret),
    ],
    'env_vars_raw' => [
        'GHL_CLIENT_ID_from_env'        => getenv('GHL_CLIENT_ID') ?: '(not set — using fallback)',
        'GHL_AGENCY_CLIENT_ID_from_env' => getenv('GHL_AGENCY_CLIENT_ID') ?: '(not set — using fallback)',
    ],
], JSON_PRETTY_PRINT);
