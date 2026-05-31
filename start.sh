#!/bin/bash
mkdir -p uploads/avatars
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
