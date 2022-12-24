alias r := run
alias p := ping

run:
    wrangler dev --local

ping:
    http "http://localhost:8787/cdn-cgi/mf/scheduled"
