@echo off
echo ============================================================
echo           REVIEW SCRAPER CLEANUP SCRIPT
echo ============================================================
echo This script will perform the following cleanup operations:
echo 1. Move the backup-files directory to backup-files-old
echo 2. Move test HTML files to a temporary location
echo 3. Move test scripts to a temporary location
echo 4. Move debug files to a temporary location
echo 5. Remove the retailer-review-scraper directory (duplicate)
echo.
echo Starting cleanup...
echo.

REM Create necessary directories
echo Creating temporary directories...
if not exist "temp_html" mkdir temp_html
if not exist "temp_test_scripts" mkdir temp_test_scripts
if not exist "temp_debug" mkdir temp_debug
if not exist "backup-files-old" mkdir backup-files-old
echo.

REM Step 1: Move backup-files to backup-files-old
echo Step 1: Moving backup-files directory to backup-files-old...
if exist "backup-files" (
    xcopy /E /I /Y "backup-files\*" "backup-files-old\"
    rd /S /Q "backup-files"
    echo Successfully moved backup-files to backup-files-old.
) else (
    echo backup-files directory not found, skipping.
)
echo.

REM Step 2: Move test HTML files to temporary location
echo Step 2: Moving test HTML files to temporary location...
for %%F in (
    asda-page-html-*.html
    sainsburys-page-html-*.html
    tesco-page-html-*.html
    morrisons-reviews-html.html
) do (
    if exist "%%F" (
        move "%%F" "temp_html\"
        echo Moved %%F to temp_html\
    )
)
echo.

REM Step 3: Move test scripts to temporary location
echo Step 3: Moving test scripts to temporary location...
for %%F in (test-*.js) do (
    if exist "%%F" (
        move "%%F" "temp_test_scripts\"
        echo Moved %%F to temp_test_scripts\
    )
)
if exist "test-response.csv" (
    move "test-response.csv" "temp_test_scripts\"
    echo Moved test-response.csv to temp_test_scripts\
)
echo.

REM Step 4: Move debug files to temporary location
echo Step 4: Moving debug files to temporary location...
for %%F in (
    debug-*.html
    debug-*.js
    *-reviews-html.json
    *-reviews-info.json
    *-reviews.json
    *-simple-results.json
) do (
    if exist "%%F" (
        move "%%F" "temp_debug\"
        echo Moved %%F to temp_debug\
    )
)
echo.

REM Step 5: Remove the retailer-review-scraper directory
echo Step 5: Removing retailer-review-scraper directory (duplicate)...
if exist "retailer-review-scraper" (
    rd /S /Q "retailer-review-scraper"
    echo Successfully removed retailer-review-scraper directory.
) else (
    echo retailer-review-scraper directory not found, skipping.
)
echo.

REM Clean up additional files identified in cleanup.js
echo Step 6: Cleaning up additional files...

REM Old handler files
for %%F in (
    asda-handler-fixed.js
    asda-handler-new.js
    asda-handler-no-fallbacks.js
    asda-handler-simplified.js
    asda-handler-updated.js
    asda-handler.js
    fixed-asda-handler.js
    morrisons-handler-final.js
    morrisons-handler-fixed.js
    morrisons-handler-new.js
    morrisons-handler-optimized.js
    morrisons-handler-ratings-fixed.js
    morrisons-handler-updated.js
    morrisons-handler.js
    sainsburys-handler-deduped.js
    sainsburys-handler-fixed.js
    sainsburys-handler-new.js
    sainsburys-handler-updated.js
    sainsburys-handler.js
    tesco-handler-button-fixed.js
    tesco-handler-button-improved.js
    tesco-handler-direct-navigation.js
    tesco-handler-fixed.js
    tesco-handler-new.js
    tesco-handler-original-page.js
    tesco-handler-updated.js
    tesco-handler-wait-for-reviews.js
    tesco-handler.js
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Old update scripts
for %%F in (
    update-asda-handler.js
    update-asda-simplified.js
    update-morrisons-final.js
    update-morrisons-handler.js
    update-morrisons-optimized.js
    update-morrisons-ratings.js
    update-sainsburys-deduped.js
    update-sainsburys-fixed.js
    update-sainsburys-handler.js
    update-scraper.js
    update-tesco-button-improved.js
    update-tesco-button.js
    update-tesco-direct.js
    update-tesco-fixed.js
    update-tesco-handler.js
    update-tesco-original.js
    update-tesco-wait.js
    update-ui.js
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Outdated utility files
for %%F in (
    morrisons-date-extractor.js
    morrisons-date-fix.js
    morrisons-date-patch.js
    integrate-date-extractor.js
    fix-headless-mode.js
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Old server versions
for %%F in (
    server-combined.js
    server-fixed.js
    server-new.js
    simple-server.js
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Old scraper versions
for %%F in (
    review-scraper-crawlee.js
    review-scraper-fixed.js
    review-scraper.js
    puppeteer-review-scraper.js
    review_scraper.py
    review-scraper-integrated.js
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Unused files in public directory
for %%F in (
    public\index-new.html
    public\index.html.backup
    public\test.html
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Other files
for %%F in (
    reviews.xlsx
    start-test-server.bat
    start-test-server.sh
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

REM Clean up backup files
for %%F in (
    review-scraper-crawlee-fixed.backup-asda-simplified.js
    review-scraper-crawlee-fixed.backup-asda-updated.js
    review-scraper-crawlee-fixed.backup-sainsburys-deduped.js
    review-scraper-crawlee-fixed.backup-sainsburys-fixed.js
    review-scraper-crawlee-fixed.backup-sainsburys-updated.js
    review-scraper-crawlee-fixed.backup-tesco-button-improved.js
    review-scraper-crawlee-fixed.backup-tesco-button.js
    review-scraper-crawlee-fixed.backup-tesco-direct.js
    review-scraper-crawlee-fixed.backup-tesco-fixed.js
    review-scraper-crawlee-fixed.backup-tesco-original.js
    review-scraper-crawlee-fixed.backup-tesco-wait.js
    review-scraper-crawlee-fixed.backup-tesco.js
    review-scraper-crawlee-fixed.backup.js
    review-scraper-crawlee-fixed.backup3.js
    review-scraper-crawlee-fixed.backup4.js
    review-scraper-crawlee-fixed.backup5.js
) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

echo.
echo ============================================================
echo             CLEANUP COMPLETED SUCCESSFULLY
echo ============================================================
echo.
echo Files have been organized as follows:
echo.
echo 1. Backup files moved to: backup-files-old\
echo 2. Test HTML files moved to: temp_html\
echo 3. Test scripts moved to: temp_test_scripts\
echo 4. Debug files moved to: temp_debug\
echo 5. retailer-review-scraper directory has been removed
echo.
echo The project structure has been cleaned up and organized.
echo You may now delete the temporary directories if their contents
echo are no longer needed.
echo ============================================================

pause