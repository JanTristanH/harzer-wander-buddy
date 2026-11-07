#!/bin/sh
set -eu
export NODE_ENV="${NODE_ENV:-production}"
exec node util/startProduction.js
