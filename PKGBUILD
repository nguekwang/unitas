# Maintainer: Yoshi <nguekwang@gmail.com>
# Builds from the local checkout: run `makepkg -si` in the repository root.
pkgname=unitas
pkgver=0.1.0
pkgrel=1
pkgdesc='Browser, editor and PDF/Markdown/HTML viewer in one tabbed Electron window'
arch=('x86_64' 'aarch64') # node-pty is a native module
url='https://github.com/nguekwang/unitas'
license=('unknown')
depends=('electron')
makedepends=('npm' 'python') # python: node-gyp builds node-pty
options=('!strip')

_files=(main.js shell.html shell-preload.js editor.html editor-preload.js terminal.html terminal-preload.js
        start.html vomnibar.html vomnibar-preload.js ui.css background content package.json package-lock.json)

prepare() {
  mkdir -p "$srcdir/$pkgname"
  for f in "${_files[@]}"; do cp -r "$startdir/$f" "$srcdir/$pkgname/"; done
}

build() {
  cd "$srcdir/$pkgname"
  npm ci --omit=dev --cache "$srcdir/npm-cache"
  # Only the minified Monaco build (min/vs) is loaded at runtime
  rm -rf node_modules/monaco-editor/{dev,esm,min-maps}
  # node-pty: compiled here with node-gyp. It uses N-API, so the same binary works in the system Electron.
  # Keep only the JS and the compiled module (the C++ sources and build files are ~60MB)
  local pty=node_modules/node-pty
  find "${pty:?}/build" -mindepth 1 -maxdepth 1 ! -name Release -exec rm -rf {} +
  find "${pty:?}/build/Release" -mindepth 1 ! -name pty.node -exec rm -rf {} +
  rm -rf "${pty:?}"/{deps,src,scripts,third_party,prebuilds,typings,node-addon-api,binding.gyp}
  rm -f "${pty:?}"/lib/*.map "${pty:?}"/lib/*.test.js
}

package() {
  install -d "$pkgdir/usr/lib/$pkgname"
  cp -r "$srcdir/$pkgname/." "$pkgdir/usr/lib/$pkgname/"
  rm "$pkgdir/usr/lib/$pkgname/package-lock.json"
  install -Dm755 "$startdir/unitas.sh" "$pkgdir/usr/bin/unitas"
  install -Dm644 "$startdir/unitas.desktop" "$pkgdir/usr/share/applications/unitas.desktop"
  install -Dm644 "$startdir/unitas.svg" "$pkgdir/usr/share/icons/hicolor/scalable/apps/unitas.svg"
}
