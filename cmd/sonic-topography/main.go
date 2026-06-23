package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
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

	listener, port, err := listen()
	if err != nil {
		log.Fatalf("start listener: %v", err)
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

func listen() (net.Listener, int, error) {
	preferredPort := 4173
	if raw := os.Getenv("PORT"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			preferredPort = value
		}
	}
	listener, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(preferredPort))
	if err == nil {
		return listener, preferredPort, nil
	}
	listener, err = net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, 0, err
	}
	return listener, listener.Addr().(*net.TCPAddr).Port, nil
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
