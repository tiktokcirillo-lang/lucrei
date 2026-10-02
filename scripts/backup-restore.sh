#!/bin/sh
# Explicit project and destination required. Never restore over production.
set -eu
command_name=${1:-help}
project_id=${FIREBASE_PROJECT_ID:?Defina FIREBASE_PROJECT_ID}
case "$command_name" in
 export)
  backup_uri=${BACKUP_URI:?Defina BACKUP_URI como gs://bucket/pasta-nova}
  gcloud firestore export "$backup_uri" --project="$project_id" --database='(default)'
  ;;
 restore-test)
  backup_uri=${BACKUP_URI:?Defina BACKUP_URI}
  restore_project=${RESTORE_PROJECT_ID:?Defina um projeto separado para teste}
  if [ "$restore_project" = "$project_id" ]; then echo 'Restauração em produção bloqueada.' >&2; exit 1; fi
  gcloud firestore import "$backup_uri" --project="$restore_project" --database='(default)'
  ;;
 *) echo 'Uso: backup-restore.sh export | restore-test'; exit 1 ;;
esac
