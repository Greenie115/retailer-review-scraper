@echo off
echo Review Scraper Cleanup Utility
echo -----------------------------
echo This script will back up and remove unnecessary files from the project.
echo All removed files will be backed up to the "backup-files" directory.
echo.

REM Create backup directory if it doesn't exist
if not exist "backup-files" mkdir backup-files
echo Backup directory created: backup-files

echo.
echo Starting cleanup process...
echo.

REM Backup files
call :processFile "review-scraper-crawlee-fixed.backup-asda-simplified.js"
call :processFile "review-scraper-crawlee-fixed.backup-asda-updated.js"
call :processFile "review-scraper-crawlee-fixed.backup-sainsburys-deduped.js"
call :processFile "review-scraper-crawlee-fixed.backup-sainsburys-fixed.js"
call :processFile "review-scraper-crawlee-fixed.backup-sainsburys-updated.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco-button-improved.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco-button.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco-direct.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco-fixed.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco-original.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco-wait.js"
call :processFile "review-scraper-crawlee-fixed.backup-tesco.js"
call :processFile "review-scraper-crawlee-fixed.backup.js"
call :processFile "review-scraper-crawlee-fixed.backup3.js"
call :processFile "review-scraper-crawlee-fixed.backup4.js"
call :processFile "review-scraper-crawlee-fixed.backup5.js"

REM Old handler files
call :processFile "asda-handler-fixed.js"
call :processFile "asda-handler-new.js"
call :processFile "asda-handler-no-fallbacks.js"
call :processFile "asda-handler-simplified.js"
call :processFile "asda-handler-updated.js"
call :processFile "asda-handler.js"
call :processFile "fixed-asda-handler.js"
call :processFile "morrisons-handler-final.js"
call :processFile "morrisons-handler-fixed.js"
call :processFile "morrisons-handler-new.js"
call :processFile "morrisons-handler-optimized.js"
call :processFile "morrisons-handler-ratings-fixed.js"
call :processFile "morrisons-handler-updated.js"
call :processFile "morrisons-handler.js"
call :processFile "sainsburys-handler-deduped.js"
call :processFile "sainsburys-handler-fixed.js"
call :processFile "sainsburys-handler-new.js"
call :processFile "sainsburys-handler-updated.js"
call :processFile "sainsburys-handler.js"
call :processFile "tesco-handler-button-fixed.js"
call :processFile "tesco-handler-button-improved.js"
call :processFile "tesco-handler-direct-navigation.js"
call :processFile "tesco-handler-fixed.js"
call :processFile "tesco-handler-new.js"
call :processFile "tesco-handler-original-page.js"
call :processFile "tesco-handler-updated.js"
call :processFile "tesco-handler-wait-for-reviews.js"
call :processFile "tesco-handler.js"

REM Old update scripts
call :processFile "update-asda-handler.js"
call :processFile "update-asda-simplified.js"
call :processFile "update-morrisons-final.js"
call :processFile "update-morrisons-handler.js"
call :processFile "update-morrisons-optimized.js"
call :processFile "update-morrisons-ratings.js"
call :processFile "update-sainsburys-deduped.js"
call :processFile "update-sainsburys-fixed.js"
call :processFile "update-sainsburys-handler.js"
call :processFile "update-scraper.js"
call :processFile "update-tesco-button-improved.js"
call :processFile "update-tesco-button.js"
call :processFile "update-tesco-direct.js"
call :processFile "update-tesco-fixed.js"
call :processFile "update-tesco-handler.js"
call :processFile "update-tesco-original.js"
call :processFile "update-tesco-wait.js"
call :processFile "update-ui.js"

REM Test files
call :processFile "test-asda-handler.js"
call :processFile "test-date-extractor.js"
call :processFile "test-delete-screenshots.js"
call :processFile "test-morrisons-direct.js"
call :processFile "test-morrisons-handler.js"
call :processFile "test-morrisons-simple.js"
call :processFile "test-screenshot-deletion.js"
call :processFile "test-server.js"
call :processFile "test-tesco-general.js"
call :processFile "test-tesco-reviews.js"
call :processFile "test-asda.js"
call :processFile "test-endpoint.js"
call :processFile "test-integrated-server.js"
call :processFile "test-integrated.js"
call :processFile "test-local-browser-service.js"
call :processFile "test-popular-product.js"
call :processFile "test-sainsburys.js"
call :processFile "test-scraper.js"
call :processFile "test-tesco-production.js"
call :processFile "test-web-interface.js"
call :processFile "test-response.csv"

REM Outdated utility files
call :processFile "morrisons-date-extractor.js"
call :processFile "morrisons-date-fix.js"
call :processFile "morrisons-date-patch.js"
call :processFile "integrate-date-extractor.js"
call :processFile "fix-headless-mode.js"

REM Old server versions
call :processFile "server-combined.js"
call :processFile "server-fixed.js"
call :processFile "server-new.js"
call :processFile "simple-server.js"

REM Old scraper versions
call :processFile "review-scraper-crawlee.js"
call :processFile "review-scraper-fixed.js"
call :processFile "review-scraper.js"
call :processFile "puppeteer-review-scraper.js"
call :processFile "review_scraper.py"
REM Removed review-scraper-integrated.js from this list to keep it

REM HTML/JSON debug files
call :processFile "asda-page-html-1745925572200.html"
call :processFile "asda-page-html-1745933235365.html"
call :processFile "sainsburys-page-html-1745928076214.html"
call :processFile "sainsburys-page-html-1745928508950.html"
call :processFile "sainsburys-page-html-1745933178378.html"
call :processFile "sainsburys-reviews-html.txt"
call :processFile "tesco-page-html-1745498615108.html"
call :processFile "tesco-page-html-1745838104410.html"
call :processFile "tesco-reviews-html.json"
call :processFile "tesco-reviews-info.json"
call :processFile "tesco-reviews.json"
call :processFile "morrisons-reviews-html.html"
call :processFile "morrisons-reviews.json"
call :processFile "morrisons-simple-results.json"
call :processFile "debug-tesco-initial.html"
call :processFile "debug-tesco-after-scroll.html"
call :processFile "debug-tesco-page.js"
call :processFile "asda-page-html-1745935522801.html"

REM Unused files in public directory
call :processFile "public/index-new.html"
call :processFile "public/index.html.backup"
call :processFile "public/test.html"

REM Other files
call :processFile "reviews.xlsx"
call :processFile "start-test-server.bat"
call :processFile "start-test-server.sh"

REM Remove duplicate retailer-review-scraper directory
if exist "retailer-review-scraper" (
  echo Removing duplicate retailer-review-scraper directory...
  rd /s /q "retailer-review-scraper"
  echo Successfully removed duplicate directory.
) else (
  echo Skipped: retailer-review-scraper (directory not found)
)

echo.
echo Cleanup Complete!
echo All removed files have been backed up to the "backup-files" directory.
echo If you need to restore any files, you can find them in the backup directory.
echo.

goto :eof

:processFile
if exist %1 (
  echo Backing up and removing: %1
  copy %1 "backup-files\"
  del %1
) else (
  echo Skipped: %1 (file not found)
)
goto :eof