import fs from 'fs'
import gulp from 'gulp'
import zip from 'gulp-zip'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifest = require('../build/manifest.json')

const packageJsonPath = path.resolve(__dirname, '../package.json')
const packageDir = path.resolve(__dirname, '../package')
const MAX_VERSIONS = 3

function cleanOldVersions() {
  const files = fs
    .readdirSync(packageDir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => ({
      name: f,
      path: path.join(packageDir, f),
      mtime: fs.statSync(path.join(packageDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime)

  if (files.length > MAX_VERSIONS) {
    files.slice(MAX_VERSIONS).forEach((f) => {
      fs.unlinkSync(f.path)
      console.log(`Deleted old version: ${f.name}`)
    })
  }
}

function bumpVersion() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const [major, minor, patch] = pkg.version.split('.').map(Number)
  pkg.version = `${major}.${minor}.${patch + 1}`
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`Version bumped to ${pkg.version}`)
}

gulp
  .src('build/**', { encoding: false })
  .pipe(zip(`${manifest.name.replaceAll(' ', '-')}-${manifest.version}.zip`))
  .pipe(gulp.dest('package'))
  .on('end', () => {
    cleanOldVersions()
    bumpVersion()
  })
