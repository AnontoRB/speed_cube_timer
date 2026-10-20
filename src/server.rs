// CubeTimer server (no crates needed). Serves the site and stores everyone's saved data in data.json.
// Build: rustc -O server.rs -o server     Run: ./server     (PORT=3000 ./server to change the port)
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::{env, fs, thread};

const MAX_BODY: usize = 5_000_000;

fn respond(s: &mut TcpStream, code: &str, ctype: &str, body: &[u8]) {
    let h = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
        code, ctype, body.len()
    );
    let _ = s.write_all(h.as_bytes());
    let _ = s.write_all(body);
}

fn mime(p: &Path) -> Option<&'static str> {
    Some(match p.extension()?.to_str()? {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "wasm" => "application/wasm",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        _ => return None, // data.json, server.rs, Cargo.toml etc. are never served
    })
}

fn handle(mut s: TcpStream, lock: Arc<Mutex<()>>, file: Arc<PathBuf>) {
    let _ = s.set_read_timeout(Some(std::time::Duration::from_secs(10)));
    let mut r = BufReader::new(match s.try_clone() {
        Ok(c) => c,
        Err(_) => return,
    });
    let mut line = String::new();
    if r.read_line(&mut line).unwrap_or(0) == 0 {
        return;
    }
    let mut it = line.split_whitespace();
    let method = it.next().unwrap_or("").to_string();
    let target = it.next().unwrap_or("/").to_string();
    let mut len = 0usize;
    loop {
        let mut h = String::new();
        if r.read_line(&mut h).unwrap_or(0) == 0 || h.trim().is_empty() {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            if k.eq_ignore_ascii_case("content-length") {
                len = v.trim().parse().unwrap_or(0);
            }
        }
    }
    if len > MAX_BODY {
        return respond(&mut s, "413 Payload Too Large", "text/plain", b"too big");
    }
    let mut body = vec![0u8; len];
    if len > 0 && r.read_exact(&mut body).is_err() {
        return;
    }

    let path = target.split('?').next().unwrap_or("/");
    if path == "/api/state" {
        let _g = lock.lock().unwrap();
        match method.as_str() {
            "GET" => {
                let b = fs::read(&*file).unwrap_or_else(|_| b"{}".to_vec());
                respond(&mut s, "200 OK", "application/json", &b)
            }
            "PUT" | "POST" => {
                if body.first() != Some(&b'{') {
                    return respond(&mut s, "400 Bad Request", "text/plain", b"bad body");
                }
                let tmp = file.with_extension("tmp");
                if fs::write(&tmp, &body).and_then(|_| fs::rename(&tmp, &*file)).is_ok() {
                    respond(&mut s, "200 OK", "application/json", b"{\"ok\":true}")
                } else {
                    respond(&mut s, "500 Internal Server Error", "text/plain", b"write failed")
                }
            }
            _ => respond(&mut s, "405 Method Not Allowed", "text/plain", b"no"),
        }
        return;
    }
    if method != "GET" {
        return respond(&mut s, "405 Method Not Allowed", "text/plain", b"no");
    }
    let rel = if path == "/" {
        "index.html"
    } else {
        path.trim_start_matches('/')
    };
    let p = PathBuf::from(rel);
    let bad = p.components().any(|c| match c {
        Component::Normal(n) => n.to_string_lossy().starts_with('.'),
        _ => true,
    });
    if bad {
        return respond(&mut s, "400 Bad Request", "text/plain", b"bad path");
    }
    match (mime(&p), fs::read(&p)) {
        (Some(m), Ok(b)) => respond(&mut s, "200 OK", m, &b),
        _ => respond(&mut s, "404 Not Found", "text/plain", b"not found"),
    }
}

fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "8000".into());
    let file = Arc::new(PathBuf::from(
        env::var("DATA_FILE").unwrap_or_else(|_| "data.json".into()),
    ));
    let lock = Arc::new(Mutex::new(()));
    let l = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("cannot open the port");
    println!(
        "CubeTimer running on http://localhost:{}  (saved data: {})",
        port,
        file.display()
    );
    for s in l.incoming().flatten() {
        let (lk, f) = (lock.clone(), file.clone());
        thread::spawn(move || handle(s, lk, f));
    }
}