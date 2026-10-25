# Maintainer: Yoshi <nguekwang@gmail.com>
# Builds from the local checkout: run `makepkg -si` in the repository root.
pkgname=unitas
pkgver=0.1.0
pkgrel=1
pkgdesc='Browser, editor and PDF/Markdown/HTML viewer in one tabbed Electron window'
arch=('any')
url='https://github.com/nguekwang/unitas'
license=('unknown')
depends=('electron')
makedepends=('npm')
options=('!strip')

_files=(main.js shell.html shell-preload.js editor.html editor-preload.js start.html package.json package-lock.json)

prepare() {
  mkdir -p "$srcdir/$pkgname"
  for f in "${_files[@]}"; do cp "$startdir/$f" "$srcdir/$pkgname/"; done
}

build() {
  cd "$srcdir/$pkgname"
  npm ci --omit=dev --cache "$srcdir/npm-cache"
  # Only the minified Monaco build (min/vs) is loaded at runtime
  rm -rf node_modules/monaco-editor/{dev,esm,min-maps}
}

package() {
  install -d "$pkgdir/usr/lib/$pkgname"
  cp -r "$srcdir/$pkgname/." "$pkgdir/usr/lib/$pkgname/"
  rm "$pkgdir/usr/lib/$pkgname/package-lock.json"
  install -Dm755 "$startdir/unitas.sh" "$pkgdir/usr/bin/unitas"
  install -Dm644 "$startdir/unitas.desktop" "$pkgdir/usr/share/applications/unitas.desktop"
  install -Dm644 "$startdir/unitas.svg" "$pkgdir/usr/share/icons/hicolor/scalable/apps/unitas.svg"
}
