### Script for finding a dentist

This is a scrapping script. It scraps a list of doctors from a web page, then uses the Google geocoding API to localize them and sort them by proximity to home.

### How to use

1. Set env vars `GOOGLE_API_KEY`, `COOKIE` (copied from [this page](https://www.hospitalaleman.org.ar/plan-medico/quiero-asociarme/cartillas-online), and `MY ADDRESS`.
2. Run ```npm run start```.

The output will be displayed to stdout and stored in `tmp/output.txt`.