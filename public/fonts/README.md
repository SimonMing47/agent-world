# Local Font Assets

AgentWorld loads UI fonts from this directory so the browser never downloads fonts from the public internet at runtime.

Bundled defaults:

- `NotoSansSC-Variable.ttf` for multilingual UI text.
- `SourceCodePro-Variable.ttf` for code and monospace surfaces.

Replace these files only with approved internal font artifacts and keep the filenames stable unless `src/app/globals.css` is updated at the same time.
