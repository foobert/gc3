#!/bin/bash
set -e

function generate {
  local src=$1
  local target=$2
  echo Generating ${src}
  mkdir -p build
  node index.js "${src}" > temp.gpx
  docker run --rm -v ${PWD}:/app -w /app jamesmstone/gpsbabel \
    -i gpx \
    -f temp.gpx \
    -o "garmin_gpi,bitmap=img/${target}.bmp,sleep=1" \
    -F "build/${target}.gpi"
  rm temp.gpx
}

generate "Traditional Geocache" tradi
generate "Multi-cache" multi
generate "EarthCache" earth

ls -lh build
