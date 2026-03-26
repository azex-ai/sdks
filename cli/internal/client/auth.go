package client

import (
	"errors"

	"github.com/azex-ai/azex/cli/internal/config"
)

// ErrNoAPIKey is returned when no API key is configured.
var ErrNoAPIKey = errors.New("no API key configured — run `azex auth login` or set AZEX_API_KEY")

// ResolveAPIKey returns the API key from config, validating it's present.
func ResolveAPIKey(cfg *config.Config) (string, error) {
	key := cfg.ResolvedAPIKey()
	if key == "" {
		return "", ErrNoAPIKey
	}
	return key, nil
}
