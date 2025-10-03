Local development server required for ES modules

Browsers block ES module imports when opening files via the file:// protocol. To run the project locally you should serve the folder using a simple static server.

Quick options (run from the project root):

1) Recommended — Python 3 (quick and simple)

   python -m http.server 8000

   Then open:
   http://localhost:8000/index.html

2) If you prefer PowerShell-only (no Python), run the included script which uses .NET HttpListener and serves correct MIME types:

   powershell -ExecutionPolicy Bypass -File .\start-server.ps1

   Then open:
   http://localhost:8000/index.html

3) Using Node (npx http-server):

   npx http-server -p 8000

   Then open:
   http://localhost:8000/index.html

Notes
- Stop the server with Ctrl+C in the same terminal.
- If a browser reports a module/MIME error, make sure you are using HTTP (http://localhost...) — ES modules require being served, not opened via file://.
- The repository includes `start-server.bat` and `start-server.ps1` helpers. `start-server.bat` tries Python first; `start-server.ps1` is a standalone PowerShell server that sets proper Content-Type headers for .js/.mjs files.

If you want, I can also add a one-line npm script to package.json to make starting the server even easier.


Notes:
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
