<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$host = 'localhost';
$db   = 'puskarcik_db';
$user = 'puskarcik_user';
$pass = 'your_password'; // Enter your DB password here if configured

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $id = isset($_GET['id']) ? intval($_GET['id']) : 1;

    $stmt = $pdo->prepare("SELECT * FROM people WHERE id = ?");
    $stmt->execute([$id]);
    $person = $stmt->fetch();

    if ($person) {
        echo json_encode(['success' => true, 'data' => $person]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Person not found']);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
