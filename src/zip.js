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
  .on('end', bumpVersion)
