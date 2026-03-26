package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	DefaultBaseURL = "https://api.azex.ai"
	configDir      = "azex"
	configFile     = "config.json"
)

// Config holds user configuration persisted to ~/.config/azex/config.json
type Config struct {
	APIKey       string            `json:"api_key,omitempty"`
	BaseURL      string            `json:"base_url,omitempty"`
	DefaultModel string            `json:"default_model,omitempty"`
	Profiles     map[string]string `json:"profiles,omitempty"`
}

func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine config dir: %w", err)
	}
	return filepath.Join(dir, configDir, configFile), nil
}

// Load reads the config file. Returns empty config if it doesn't exist.
func Load() (*Config, error) {
	path, err := configPath()
	if err != nil {
		return &Config{}, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return &cfg, nil
}

// Save writes the config to disk, creating directories as needed.
func Save(cfg *Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}

// ResolvedAPIKey returns the API key: env var takes highest priority, then config file.
func (c *Config) ResolvedAPIKey() string {
	if v := os.Getenv("AZEX_API_KEY"); v != "" {
		return v
	}
	return c.APIKey
}

// ResolvedBaseURL returns base URL from env or config, falling back to default.
func (c *Config) ResolvedBaseURL() string {
	if v := os.Getenv("AZEX_BASE_URL"); v != "" {
		return v
	}
	if c.BaseURL != "" {
		return c.BaseURL
	}
	return DefaultBaseURL
}

// Path returns the config file path for display purposes.
func Path() string {
	p, _ := configPath()
	return p
}

// Get returns a config value by key.
func (c *Config) Get(key string) (string, bool) {
	switch key {
	case "api_key":
		return c.APIKey, c.APIKey != ""
	case "base_url":
		return c.BaseURL, c.BaseURL != ""
	case "default_model":
		return c.DefaultModel, c.DefaultModel != ""
	default:
		return "", false
	}
}

// Set sets a config value by key.
func (c *Config) Set(key, value string) error {
	switch key {
	case "api_key":
		c.APIKey = value
	case "base_url":
		c.BaseURL = value
	case "default_model":
		c.DefaultModel = value
	default:
		return fmt.Errorf("unknown config key %q (valid: api_key, base_url, default_model)", key)
	}
	return nil
}

// All returns all config key-value pairs.
func (c *Config) All() map[string]string {
	m := make(map[string]string)
	if c.APIKey != "" {
		m["api_key"] = c.APIKey
	}
	if c.BaseURL != "" {
		m["base_url"] = c.BaseURL
	}
	if c.DefaultModel != "" {
		m["default_model"] = c.DefaultModel
	}
	return m
}
