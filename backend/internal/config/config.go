package config

import (
	"fmt"
	"os"
)

type Config struct {
	ListenAddr      string
	DatabaseURL     string
	APISecretKey    string
	VAPIDSubject    string
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	StaticDir       string
	Env             string
}

func Load() *Config {
	return &Config{
		ListenAddr:      addrFromEnv(),
		DatabaseURL:     getEnv("DATABASE_URL", "file:./dev.db"),
		APISecretKey:    os.Getenv("API_SECRET_KEY"),
		VAPIDSubject:    os.Getenv("VAPID_SUBJECT"),
		VAPIDPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
		VAPIDPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
		StaticDir:       os.Getenv("STATIC_DIR"),
		Env:             getEnv("ENV", getEnv("NODE_ENV", "development")),
	}
}

func addrFromEnv() string {
	host := getEnv("HOSTNAME", "0.0.0.0")
	port := getEnv("PORT", "3000")
	return fmt.Sprintf("%s:%s", host, port)
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
