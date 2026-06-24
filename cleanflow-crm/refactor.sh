#!/bin/bash

echo "Starting CRM refactor..."

find src -type f \( -name "*.js" -o -name "*.jsx" \) | while read file
do
  sed -i '
    s/\bContacts\b/Customers/g;
    s/\bcontacts\b/customers/g;
    s/\bPipeline\b/Jobs/g;
    s/\bpipeline\b/jobs/g;
    s/Quixotic CRM/CleanFlow CRM/g;
    s/TTP CRM/CleanFlow CRM/g;
  ' "$file"
done

echo "Refactor complete."