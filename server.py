import http.server
import socketserver
import sys

def start_server(port):
    Handler = http.server.SimpleHTTPRequestHandler
    Handler.extensions_map.update({
        '.js': 'application/javascript',
    })
    
    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print(f"Server started at http://localhost:{port}")
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Port {port} is in use, trying port {port + 1}")
            start_server(port + 1)
        else:
            print(f"Error starting server: {e}")
            sys.exit(1)

if __name__ == "__main__":
    start_server(8000) 