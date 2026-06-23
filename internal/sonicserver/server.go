package sonicserver

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const neteaseCookieHeader = "x-netease-cookie"

var baseNeteaseHeaders = map[string]string{
	"Referer":    "https://music.163.com/",
	"User-Agent": "Mozilla/5.0",
	"Accept":     "application/json, text/plain, */*",
	"Connection": "close",
}

type Config struct {
	PlaylistsPath string
	StaticFS      fs.FS
	Client        *http.Client
}

type Server struct {
	playlistsPath string
	staticFS      fs.FS
	client        *http.Client

	mu                   sync.RWMutex
	browserNeteaseCookie string
	playableURLCache     map[string]cachedURL
	searchCache          map[string]cachedSearch
}

type Playlist struct {
	ID    string           `json:"id"`
	Name  string           `json:"name"`
	Songs []map[string]any `json:"songs"`
}

type NeteaseSong struct {
	ID       any    `json:"id"`
	Name     string `json:"name"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	Duration any    `json:"duration"`
	Fee      any    `json:"fee"`
}

type Account struct {
	Valid    bool   `json:"valid"`
	UserID   any    `json:"userId"`
	Nickname string `json:"nickname"`
}

type cachedURL struct {
	URL       string
	ExpiresAt time.Time
}

type cachedSearch struct {
	Payload   searchPayload
	ExpiresAt time.Time
}

type searchPayload struct {
	Songs         []NeteaseSong  `json:"songs"`
	RawCount      int            `json:"rawCount"`
	FilteredCount int            `json:"filteredCount"`
	Debug         map[string]any `json:"debug,omitempty"`
	Cached        bool           `json:"cached,omitempty"`
}

func New(config Config) *Server {
	client := config.Client
	if client == nil {
		client = &http.Client{Timeout: 25 * time.Second}
	}
	playlistsPath := config.PlaylistsPath
	if playlistsPath == "" {
		playlistsPath = DefaultPlaylistsPath()
	}
	return &Server{
		playlistsPath:    playlistsPath,
		staticFS:         config.StaticFS,
		client:           client,
		playableURLCache: make(map[string]cachedURL),
		searchCache:      make(map[string]cachedSearch),
	}
}

func DefaultPlaylistsPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		configDir = "."
	}
	return filepath.Join(configDir, "SonicTopography", "playlists.json")
}

func NormalizeNeteaseCookie(value string) string {
	lines := strings.FieldsFunc(value, func(r rune) bool {
		return r == '\n' || r == '\r'
	})
	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		item := strings.TrimSpace(line)
		item = strings.TrimRight(item, ";")
		item = strings.TrimSpace(item)
		if item != "" {
			parts = append(parts, item)
		}
	}
	return strings.Join(parts, "; ")
}

func DefaultPlaylists() []Playlist {
	return []Playlist{
		{ID: "favorites", Name: "Favorites", Songs: []map[string]any{}},
		{ID: "visual-set", Name: "Visual Set", Songs: []map[string]any{}},
	}
}

func NormalizePlaylists(value []Playlist) []Playlist {
	if len(value) == 0 {
		return DefaultPlaylists()
	}
	normalized := make([]Playlist, 0, len(value))
	for index, playlist := range value {
		id := strings.TrimSpace(playlist.ID)
		if id == "" {
			id = fmt.Sprintf("playlist-%d", time.Now().UnixMilli()+int64(index))
		}
		name := strings.TrimSpace(playlist.Name)
		if name == "" {
			name = "Playlist"
		}
		songs := playlist.Songs
		if songs == nil {
			songs = []map[string]any{}
		}
		normalized = append(normalized, Playlist{ID: id, Name: name, Songs: songs})
	}
	return normalized
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/playlists":
		s.handlePlaylists(w, r)
	case "/api/netease/cookie":
		s.handleNeteaseCookie(w, r)
	case "/api/netease/search":
		s.handleNeteaseSearch(w, r)
	case "/api/netease/liked":
		s.handleNeteaseLiked(w, r)
	case "/api/netease/playlists":
		s.handleNeteasePlaylists(w, r)
	case "/api/netease/playlist":
		s.handleNeteasePlaylist(w, r)
	case "/api/netease/daily-recommend":
		s.handleNeteaseDailyRecommend(w, r)
	case "/api/netease/lyric":
		s.handleNeteaseLyric(w, r)
	case "/api/netease/url":
		s.handleNeteaseURL(w, r)
	case "/api/netease/audio":
		s.handleNeteaseAudio(w, r)
	default:
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		s.serveStatic(w, r)
	}
}

func (s *Server) handlePlaylists(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		playlists, err := s.readPlaylistsFile()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Unable to read playlists"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"playlists": playlists})
	case http.MethodPut:
		var body struct {
			Playlists []Playlist `json:"playlists"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid playlists payload"})
			return
		}
		playlists, err := s.writePlaylistsFile(body.Playlists)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Unable to save playlists"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"playlists": playlists})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleNeteaseCookie(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		account, err := s.getNeteaseAccount(s.currentCookie())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Unable to check Netease cookie"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"hasCookie": s.currentCookie() != "",
			"valid":     account.Valid,
			"userId":    account.UserID,
			"nickname":  account.Nickname,
		})
	case http.MethodPut:
		var body struct {
			Cookie string `json:"cookie"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid cookie payload"})
			return
		}
		normalized := NormalizeNeteaseCookie(body.Cookie)
		s.mu.Lock()
		s.browserNeteaseCookie = normalized
		s.playableURLCache = make(map[string]cachedURL)
		s.searchCache = make(map[string]cachedSearch)
		s.mu.Unlock()

		account, err := s.getNeteaseAccount(normalized)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Unable to save Netease cookie"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"hasCookie": normalized != "",
			"valid":     account.Valid,
			"userId":    account.UserID,
			"nickname":  account.Nickname,
		})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleNeteaseSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	keywords := strings.TrimSpace(r.URL.Query().Get("keywords"))
	if keywords == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing keywords"})
		return
	}
	requestedLimit := parseIntDefault(r.URL.Query().Get("limit"), 30)
	cookie := s.readNeteaseCookie(r)
	hasCookie := cookie != ""
	resultLimit := clamp(requestedLimit, 1, 40)
	if !hasCookie {
		resultLimit = clamp(requestedLimit, 1, 20)
		if r.URL.Query().Get("limit") == "" {
			resultLimit = 12
		}
	}
	includeDebug := r.URL.Query().Get("debug") == "1"
	searchMode := "anonymous-baseline"
	if hasCookie {
		searchMode = "cookie::" + cookie
	}
	cacheKey := strings.ToLower(keywords) + "::" + strconv.Itoa(resultLimit) + "::" + searchMode

	if cached, ok := s.getCachedSearch(cacheKey); ok {
		cached.Cached = true
		if !includeDebug {
			cached.Debug = nil
		}
		writeJSON(w, http.StatusOK, cached)
		return
	}

	var rawMaps []map[string]any
	debug := map[string]any{"mode": "anonymous-github"}
	var err error
	if hasCookie {
		rawMaps, debug, err = s.fetchNeteaseSearchSongs(keywords, resultLimit, cookie)
	} else {
		rawMaps, err = s.fetchAnonymousNeteaseSearchSongs(keywords, resultLimit)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease search failed"})
		return
	}

	rawSongs := make([]NeteaseSong, 0, len(rawMaps))
	for _, song := range rawMaps {
		rawSongs = append(rawSongs, mapNeteaseSong(song))
	}
	songs := s.filterPlayableSongs(rawSongs, resultLimit, cookie)
	payload := searchPayload{Songs: songs, RawCount: len(rawSongs), FilteredCount: len(songs)}
	if includeDebug {
		payload.Debug = debug
	}
	if len(rawSongs) > 0 || len(songs) > 0 {
		s.setCachedSearch(cacheKey, payload)
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) handleNeteaseLiked(w http.ResponseWriter, r *http.Request) {
	resultLimit := clamp(parseIntDefault(r.URL.Query().Get("limit"), 50), 1, 80)
	cookie := s.readNeteaseCookie(r)
	userPlaylists, valid := s.getUserPlaylists(cookie)
	if !valid || len(userPlaylists) == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Netease cookie is invalid or expired", "songs": []NeteaseSong{}})
		return
	}
	likedPlaylist := userPlaylists[0]
	songs, err := s.getPlaylistPlayableSongs(fmt.Sprint(likedPlaylist["id"]), cookie, resultLimit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease liked songs failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"songs": songs, "playlist": likedPlaylist})
}

func (s *Server) handleNeteasePlaylists(w http.ResponseWriter, r *http.Request) {
	cookie := s.readNeteaseCookie(r)
	playlists, valid := s.getUserPlaylists(cookie)
	if !valid {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Netease cookie is invalid or expired", "playlists": []map[string]any{}})
		return
	}
	if len(playlists) > 1 {
		playlists = playlists[1:]
	} else {
		playlists = []map[string]any{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"playlists": playlists})
}

func (s *Server) handleNeteasePlaylist(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing id"})
		return
	}
	resultLimit := clamp(parseIntDefault(r.URL.Query().Get("limit"), 50), 1, 80)
	cookie := s.readNeteaseCookie(r)
	account, err := s.getNeteaseAccount(cookie)
	if err != nil || !account.Valid {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Netease cookie is invalid or expired", "songs": []NeteaseSong{}})
		return
	}
	songs, err := s.getPlaylistPlayableSongs(id, cookie, resultLimit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease playlist failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"songs": songs})
}

func (s *Server) handleNeteaseDailyRecommend(w http.ResponseWriter, r *http.Request) {
	resultLimit := clamp(parseIntDefault(r.URL.Query().Get("limit"), 30), 1, 50)
	cookie := s.readNeteaseCookie(r)
	result, valid := s.getDailyRecommendSongs(cookie, resultLimit)
	if !valid {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Netease cookie is invalid or expired", "songs": []NeteaseSong{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"songs": result})
}

func (s *Server) handleNeteaseLyric(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing id"})
		return
	}
	cookie := s.readNeteaseCookie(r)
	endpoint := "https://music.163.com/api/song/lyric?id=" + url.QueryEscape(id) + "&lv=-1&kv=-1&tv=-1"
	data, err := s.fetchJSON(endpoint, http.MethodGet, nil, createNeteaseHeaders(cookie, nil))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease lyric failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"lyric":           stringFrom(nestedMap(data, "lrc")["lyric"]),
		"translatedLyric": stringFrom(nestedMap(data, "tlyric")["lyric"]),
	})
}

func (s *Server) handleNeteaseURL(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing id"})
		return
	}
	cookie := s.readNeteaseCookie(r)
	playableURL, err := s.getNeteasePlayableURL(id, cookie)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease url failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"url": nullableString(playableURL)})
}

func (s *Server) handleNeteaseAudio(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing id"})
		return
	}
	cookie := s.readNeteaseCookie(r)
	playableURL, err := s.getNeteasePlayableURL(id, cookie)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease audio proxy failed"})
		return
	}
	if playableURL == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "No playable url for this song"})
		return
	}
	headers := createNeteaseHeaders(cookie, nil)
	if r.Header.Get("Range") != "" {
		headers.Set("Range", r.Header.Get("Range"))
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, playableURL, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease audio proxy failed"})
		return
	}
	req.Header = headers
	resp, err := s.client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Netease audio proxy failed"})
		return
	}
	defer resp.Body.Close()

	for _, header := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"} {
		if value := resp.Header.Get(header); value != "" {
			w.Header().Set(header, value)
		}
	}
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "audio/mpeg")
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (s *Server) readPlaylistsFile() ([]Playlist, error) {
	raw, err := os.ReadFile(s.playlistsPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return DefaultPlaylists(), nil
		}
		return nil, err
	}
	var playlists []Playlist
	if err := json.Unmarshal(raw, &playlists); err != nil {
		return DefaultPlaylists(), nil
	}
	return NormalizePlaylists(playlists), nil
}

func (s *Server) writePlaylistsFile(playlists []Playlist) ([]Playlist, error) {
	normalized := NormalizePlaylists(playlists)
	if err := os.MkdirAll(filepath.Dir(s.playlistsPath), 0755); err != nil {
		return nil, err
	}
	raw, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(s.playlistsPath, raw, 0644); err != nil {
		return nil, err
	}
	return normalized, nil
}

func (s *Server) currentCookie() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.browserNeteaseCookie
}

func (s *Server) readNeteaseCookie(r *http.Request) string {
	headerCookie := r.Header.Get(neteaseCookieHeader)
	if headerCookie == "" {
		headerCookie = s.currentCookie()
	}
	return NormalizeNeteaseCookie(headerCookie)
}

func (s *Server) getNeteaseAccount(cookie string) (Account, error) {
	normalized := NormalizeNeteaseCookie(cookie)
	if normalized == "" {
		return Account{}, nil
	}
	data, err := s.fetchJSON("https://music.163.com/api/nuser/account/get", http.MethodGet, nil, createNeteaseHeaders(normalized, nil))
	if err != nil {
		return Account{}, err
	}
	profile := nestedMap(data, "profile")
	account := nestedMap(data, "account")
	userID := firstNonNil(profile["userId"], account["id"])
	return Account{
		Valid:    userID != nil,
		UserID:   userID,
		Nickname: stringFrom(profile["nickname"]),
	}, nil
}

func (s *Server) getNeteasePlayableURL(id string, cookie string) (string, error) {
	normalized := NormalizeNeteaseCookie(cookie)
	cacheKey := id + "::" + normalized
	s.mu.RLock()
	cached, ok := s.playableURLCache[cacheKey]
	s.mu.RUnlock()
	if ok && cached.ExpiresAt.After(time.Now()) {
		return cached.URL, nil
	}

	endpoint := "https://music.163.com/api/song/enhance/player/url?id=" + url.QueryEscape(id) + "&ids=%5B" + url.QueryEscape(id) + "%5D&br=320000"
	data, err := s.fetchJSONWithRetry(endpoint, http.MethodGet, nil, createNeteaseHeaders(normalized, nil), 2)
	if err != nil {
		return "", err
	}
	playableURL := ""
	items := sliceFrom(data["data"])
	if len(items) > 0 {
		playableURL = stringFrom(mapFrom(items[0])["url"])
	}

	s.mu.Lock()
	s.playableURLCache[cacheKey] = cachedURL{URL: playableURL, ExpiresAt: time.Now().Add(10 * time.Minute)}
	s.mu.Unlock()
	return playableURL, nil
}

func (s *Server) fetchNeteaseSearchSongs(keywords string, resultLimit int, cookie string) ([]map[string]any, map[string]any, error) {
	upstreamLimit := minInt(resultLimit*5, 80)
	body := url.Values{
		"s":      {keywords},
		"type":   {"1"},
		"offset": {"0"},
		"total":  {"true"},
		"limit":  {strconv.Itoa(upstreamLimit)},
		"_":      {strconv.FormatInt(time.Now().UnixMilli(), 10)},
	}
	headers := createNeteaseHeaders(cookie, http.Header{"Content-Type": {"application/x-www-form-urlencoded"}})
	primary, err := s.fetchJSONWithRetry("https://music.163.com/api/search/get/web", http.MethodPost, strings.NewReader(body.Encode()), headers, 2)
	if err != nil {
		return nil, nil, err
	}
	primarySongs := mapsFrom(sliceFrom(nestedMap(primary, "result")["songs"]))

	fallbackURL, _ := url.Parse("https://music.163.com/api/cloudsearch/pc")
	query := fallbackURL.Query()
	query.Set("s", keywords)
	query.Set("type", "1")
	query.Set("offset", "0")
	query.Set("total", "true")
	query.Set("limit", strconv.Itoa(upstreamLimit))
	query.Set("_", strconv.FormatInt(time.Now().UnixMilli(), 10))
	fallbackURL.RawQuery = query.Encode()
	fallback, err := s.fetchJSONWithRetry(fallbackURL.String(), http.MethodGet, nil, createNeteaseHeaders(cookie, nil), 2)
	if err != nil {
		return nil, nil, err
	}
	fallbackSongs := mapsFrom(sliceFrom(nestedMap(fallback, "result")["songs"]))

	byID := make(map[string]map[string]any)
	for _, song := range append(primarySongs, fallbackSongs...) {
		id := fmt.Sprint(song["id"])
		if id != "" {
			if _, exists := byID[id]; !exists {
				byID[id] = song
			}
		}
	}
	songs := make([]map[string]any, 0, len(byID))
	for _, song := range byID {
		songs = append(songs, song)
	}
	return songs, map[string]any{
		"primaryCode":   primary["code"],
		"primaryCount":  len(primarySongs),
		"fallbackCode":  fallback["code"],
		"fallbackCount": len(fallbackSongs),
	}, nil
}

func (s *Server) fetchAnonymousNeteaseSearchSongs(keywords string, resultLimit int) ([]map[string]any, error) {
	body := url.Values{
		"s":      {keywords},
		"type":   {"1"},
		"offset": {"0"},
		"total":  {"true"},
		"limit":  {strconv.Itoa(minInt(resultLimit*3, 60))},
	}
	headers := createNeteaseHeaders("", http.Header{"Content-Type": {"application/x-www-form-urlencoded"}})
	data, err := s.fetchJSON("https://music.163.com/api/search/get/web", http.MethodPost, strings.NewReader(body.Encode()), headers)
	if err != nil {
		return nil, err
	}
	return mapsFrom(sliceFrom(nestedMap(data, "result")["songs"])), nil
}

func (s *Server) filterPlayableSongs(rawSongs []NeteaseSong, resultLimit int, cookie string) []NeteaseSong {
	playable := make([]NeteaseSong, 0, minInt(resultLimit, len(rawSongs)))
	for index := 0; index < len(rawSongs) && len(playable) < resultLimit; index += 8 {
		end := minInt(index+8, len(rawSongs))
		type result struct {
			song NeteaseSong
			ok   bool
		}
		results := make([]result, end-index)
		var wg sync.WaitGroup
		for offset, song := range rawSongs[index:end] {
			wg.Add(1)
			go func(i int, item NeteaseSong) {
				defer wg.Done()
				playableURL, err := s.getNeteasePlayableURL(fmt.Sprint(item.ID), cookie)
				results[i] = result{song: item, ok: err == nil && playableURL != ""}
			}(offset, song)
		}
		wg.Wait()
		for _, result := range results {
			if result.ok {
				playable = append(playable, result.song)
			}
			if len(playable) >= resultLimit {
				break
			}
		}
	}
	return playable
}

func (s *Server) getUserPlaylists(cookie string) ([]map[string]any, bool) {
	account, err := s.getNeteaseAccount(cookie)
	if err != nil || !account.Valid || account.UserID == nil {
		return nil, false
	}
	endpoint := "https://music.163.com/api/user/playlist?uid=" + url.QueryEscape(fmt.Sprint(account.UserID)) + "&limit=100&offset=0"
	data, err := s.fetchJSON(endpoint, http.MethodGet, nil, createNeteaseHeaders(cookie, nil))
	if err != nil {
		return nil, false
	}
	raw := mapsFrom(sliceFrom(data["playlist"]))
	playlists := make([]map[string]any, 0, len(raw))
	for _, playlist := range raw {
		playlists = append(playlists, map[string]any{
			"id":         playlist["id"],
			"name":       stringFrom(playlist["name"]),
			"trackCount": firstNonNil(playlist["trackCount"], 0),
		})
	}
	return playlists, true
}

func (s *Server) getPlaylistPlayableSongs(playlistID string, cookie string, resultLimit int) ([]NeteaseSong, error) {
	endpoint := "https://music.163.com/api/v6/playlist/detail?id=" + url.QueryEscape(playlistID) + "&n=" + strconv.Itoa(resultLimit*2)
	data, err := s.fetchJSON(endpoint, http.MethodGet, nil, createNeteaseHeaders(cookie, nil))
	if err != nil {
		return nil, err
	}
	tracks := mapsFrom(sliceFrom(nestedMap(data, "playlist")["tracks"]))
	rawSongs := make([]NeteaseSong, 0, len(tracks))
	for _, track := range tracks {
		rawSongs = append(rawSongs, mapNeteaseSong(track))
	}
	return s.filterPlayableSongs(rawSongs, resultLimit, cookie), nil
}

func (s *Server) getDailyRecommendSongs(cookie string, resultLimit int) ([]NeteaseSong, bool) {
	if NormalizeNeteaseCookie(cookie) == "" {
		return nil, false
	}
	account, err := s.getNeteaseAccount(cookie)
	if err != nil || !account.Valid {
		return nil, false
	}
	data, err := s.fetchJSON("https://music.163.com/api/v3/discovery/recommend/songs", http.MethodGet, nil, createNeteaseHeaders(cookie, nil))
	if err != nil {
		return nil, false
	}
	raw := mapsFrom(sliceFrom(nestedMap(data, "data")["dailySongs"]))
	if len(raw) == 0 {
		raw = mapsFrom(sliceFrom(data["recommend"]))
	}
	if len(raw) == 0 {
		return nil, false
	}
	songs := make([]NeteaseSong, 0, len(raw))
	for _, song := range raw {
		songs = append(songs, mapNeteaseSong(song))
	}
	return s.filterPlayableSongs(songs, resultLimit, cookie), true
}

func (s *Server) fetchJSONWithRetry(endpoint string, method string, body io.Reader, headers http.Header, retries int) (map[string]any, error) {
	var last map[string]any
	var lastErr error
	var bodyBytes []byte
	if body != nil {
		bodyBytes, _ = io.ReadAll(body)
	}
	for attempt := 0; attempt <= retries; attempt++ {
		var reader io.Reader
		if bodyBytes != nil {
			reader = bytes.NewReader(bodyBytes)
		}
		data, err := s.fetchJSON(endpoint, method, reader, headers)
		last = data
		lastErr = err
		if err == nil && fmt.Sprint(data["code"]) != "400" {
			return data, nil
		}
		if attempt < retries {
			time.Sleep(time.Duration(180*(attempt+1)) * time.Millisecond)
		}
	}
	if last != nil {
		return last, nil
	}
	return nil, lastErr
}

func (s *Server) fetchJSON(endpoint string, method string, body io.Reader, headers http.Header) (map[string]any, error) {
	req, err := http.NewRequest(method, endpoint, body)
	if err != nil {
		return nil, err
	}
	req.Header = headers.Clone()
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var data map[string]any
	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	if err := decoder.Decode(&data); err != nil {
		return nil, err
	}
	return data, nil
}

func (s *Server) getCachedSearch(key string) (searchPayload, bool) {
	s.mu.RLock()
	cached, ok := s.searchCache[key]
	s.mu.RUnlock()
	if !ok || cached.ExpiresAt.Before(time.Now()) {
		return searchPayload{}, false
	}
	return cached.Payload, true
}

func (s *Server) setCachedSearch(key string, payload searchPayload) {
	s.mu.Lock()
	s.searchCache[key] = cachedSearch{Payload: payload, ExpiresAt: time.Now().Add(5 * time.Minute)}
	s.mu.Unlock()
}

func (s *Server) serveStatic(w http.ResponseWriter, r *http.Request) {
	if s.staticFS == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Static files are not embedded"})
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if name == "" || name == "." {
		name = "index.html"
	}
	if !s.tryServeStaticFile(w, name) {
		s.tryServeStaticFile(w, "index.html")
	}
}

func (s *Server) tryServeStaticFile(w http.ResponseWriter, name string) bool {
	file, err := s.staticFS.Open(name)
	if err != nil {
		return false
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || info.IsDir() {
		return false
	}
	raw, err := io.ReadAll(file)
	if err != nil {
		return false
	}
	if contentType := mime.TypeByExtension(filepath.Ext(name)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	_, _ = w.Write(raw)
	return true
}

func createNeteaseHeaders(cookie string, extra http.Header) http.Header {
	headers := http.Header{}
	for key, value := range baseNeteaseHeaders {
		headers.Set(key, value)
	}
	if normalized := NormalizeNeteaseCookie(cookie); normalized != "" {
		headers.Set("Cookie", normalized)
	}
	for key, values := range extra {
		for _, value := range values {
			headers.Add(key, value)
		}
	}
	return headers
}

func mapNeteaseSong(song map[string]any) NeteaseSong {
	artists := mapsFrom(sliceFrom(firstNonNil(song["artists"], song["ar"])))
	artistNames := make([]string, 0, len(artists))
	for _, artist := range artists {
		if name := stringFrom(artist["name"]); name != "" {
			artistNames = append(artistNames, name)
		}
	}
	album := mapFrom(firstNonNil(song["album"], song["al"]))
	return NeteaseSong{
		ID:       song["id"],
		Name:     stringFrom(song["name"]),
		Artist:   strings.Join(artistNames, " / "),
		Album:    stringFrom(album["name"]),
		Duration: firstNonNil(song["duration"], song["dt"], 0),
		Fee:      song["fee"],
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func parseIntDefault(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func clamp(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func nestedMap(value map[string]any, key string) map[string]any {
	return mapFrom(value[key])
}

func mapFrom(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return map[string]any{}
}

func sliceFrom(value any) []any {
	if typed, ok := value.([]any); ok {
		return typed
	}
	return []any{}
}

func mapsFrom(values []any) []map[string]any {
	mapped := make([]map[string]any, 0, len(values))
	for _, value := range values {
		if item, ok := value.(map[string]any); ok {
			mapped = append(mapped, item)
		}
	}
	return mapped
}

func stringFrom(value any) string {
	if value == nil {
		return ""
	}
	if typed, ok := value.(string); ok {
		return typed
	}
	return fmt.Sprint(value)
}

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value == nil {
			continue
		}
		if slice, ok := value.([]any); ok && len(slice) == 0 {
			continue
		}
		return value
	}
	return nil
}
