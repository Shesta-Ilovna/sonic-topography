package main

import (
	"embed"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"sonic-topography/internal/sonicserver"
)

//go:embed dist
var embeddedDist embed.FS

func main() {
	staticFS, err := fs.Sub(embeddedDist, "dist")
	if err != nil {
		log.Fatalf("load embedded dist: %v", err)
	}

	listener, port, existingAddress, err := listen()
	if err != nil {
		log.Fatalf("start listener: %v", err)
	}
	if existingAddress != "" {
		fmt.Println("Sonic Topography is already running at " + existingAddress)
		if err := openBrowser(existingAddress); err != nil {
			fmt.Println("Open this address in your browser: " + existingAddress)
		}
		return
	}
	defer listener.Close()

	server := &http.Server{
		Handler:           sonicserver.New(sonicserver.Config{StaticFS: staticFS}),
		ReadHeaderTimeout: 10 * time.Second,
	}
	address := "http://127.0.0.1:" + strconv.Itoa(port)
	fmt.Println("Sonic Topography is running at " + address)

	go func() {
		time.Sleep(300 * time.Millisecond)
		if err := openBrowser(address); err != nil {
			fmt.Println("Open this address in your browser: " + address)
		}
	}()

	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("serve: %v", err)
	}
}

func listen() (net.Listener, int, string, error) {
	preferredPort := 4173
	if raw := os.Getenv("PORT"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			preferredPort = value
		}
	}
	listener, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(preferredPort))
	if err == nil {
		return listener, preferredPort, "", nil
	}
	preferredAddress := "http://127.0.0.1:" + strconv.Itoa(preferredPort)
	if isSonicTopographyServer(preferredAddress) {
		return nil, preferredPort, preferredAddress, nil
	}
	return nil, 0, "", fmt.Errorf("%w: 127.0.0.1:%d is already in use", errPortInUse, preferredPort)
}

var errPortInUse = errors.New("Sonic Topography cannot start because the fixed port is unavailable")

func isSonicTopographyServer(address string) bool {
	client := http.Client{Timeout: 800 * time.Millisecond}
	response, err := client.Get(address)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK || !strings.Contains(response.Header.Get("Content-Type"), "text/html") {
		return false
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 4096))
	if err != nil {
		return false
	}
	return strings.Contains(string(body), "Sonic Topography")
}

func openBrowser(address string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", address).Start()
	case "darwin":
		return exec.Command("open", address).Start()
	default:
		return exec.Command("xdg-open", address).Start()
	}
}
