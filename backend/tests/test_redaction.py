from app.services.redaction import redact


def test_redacts_connection_string():
    text = "connecting to postgresql://admin:hunter2secret@db.internal:5432/prod"
    out, n = redact(text)
    assert "hunter2secret" not in out
    assert n >= 1


def test_redacts_password_kv():
    out, n = redact('config: password = "sup3rS3cret!" retries=3')
    assert "sup3rS3cret" not in out
    assert "retries=3" in out


def test_redacts_aws_key():
    out, _ = redact("using key AKIAIOSFODNN7EXAMPLE for s3 access")
    assert "AKIAIOSFODNN7EXAMPLE" not in out


def test_redacts_email():
    out, _ = redact("alert sent to oncall@example.com")
    assert "oncall@example.com" not in out


def test_redacts_bearer_token():
    out, _ = redact("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig")
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in out


def test_keeps_ordinary_log_content():
    text = "Task load_orders finished with status SUCCESS in 42.5 seconds"
    out, n = redact(text)
    assert out == text
    assert n == 0


def test_keeps_run_ids_and_hashes():
    # hex ids look high-entropy but are safe and useful for debugging
    text = "run_id=8f14e45fceea167a5a36dedd4bea2543 completed"
    out, _ = redact(text)
    assert "8f14e45fceea167a5a36dedd4bea2543" in out


def test_redacts_private_key_block():
    text = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7\n-----END RSA PRIVATE KEY-----"
    out, _ = redact(text)
    assert "MIIEpAIBAAKCAQEA7" not in out
