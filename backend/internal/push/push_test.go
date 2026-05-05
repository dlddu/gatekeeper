package push

import "testing"

func TestNormalizeSubject(t *testing.T) {
	// webpush-go 가 내부적으로 "mailto:" 를 붙이므로, 우리가 넘기는 값은
	// 이메일은 prefix 없이, http(s) URL 은 그대로여야 한다.
	cases := map[string]string{
		"":                                "",
		"mailto:admin@example.com":        "admin@example.com",
		"  mailto:admin@example.com  ":    "admin@example.com",
		"MAILTO:admin@example.com":        "admin@example.com",
		"admin@example.com":               "admin@example.com",
		"https://gatekeeper.example.com":  "https://gatekeeper.example.com",
		"http://gatekeeper.local":         "http://gatekeeper.local",
	}
	for in, want := range cases {
		if got := normalizeSubject(in); got != want {
			t.Errorf("normalizeSubject(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalizeBase64URL(t *testing.T) {
	// 65-byte uncompressed P-256 public key shape (sample, not a real key).
	raw := []byte{
		0x04,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
		0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
	}
	want := "BKvN7wEjRWeJq83vASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4k"

	// 표준 base64 (with padding, '+', '/' 가능)
	std := "BKvN7wEjRWeJq83vASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4k="
	if got := normalizeBase64URL(std); got != want {
		t.Errorf("std padded → %q, want %q", got, want)
	}

	// 이미 base64url no-pad
	if got := normalizeBase64URL(want); got != want {
		t.Errorf("already URL no-pad → %q, want %q", got, want)
	}

	// URL-safe with padding
	urlPadded := want + "="
	if got := normalizeBase64URL(urlPadded); got != want {
		t.Errorf("URL padded → %q, want %q", got, want)
	}

	// 공백 제거
	if got := normalizeBase64URL("  " + std + "  "); got != want {
		t.Errorf("trimmed → %q, want %q", got, want)
	}

	// 빈 값
	if got := normalizeBase64URL(""); got != "" {
		t.Errorf("empty → %q, want empty", got)
	}

	_ = raw // keep raw referenced for documentation purposes
}
