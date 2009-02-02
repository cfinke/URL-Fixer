rm url-fixer.xpi
rm -rf .tmp_xpi_dir/

chmod -R 0777 url-fixer/

mkdir .tmp_xpi_dir/
cp -r url-fixer/* .tmp_xpi_dir/

rm -rf `find ./.tmp_xpi_dir/ -name ".DS_Store"`
rm -rf `find ./.tmp_xpi_dir/ -name "Thumbs.db"`
rm -rf `find ./.tmp_xpi_dir/ -name ".svn"`

cd .tmp_xpi_dir/chrome/
zip -rq ../url-fixer.jar *
rm -rf *
mv ../url-fixer.jar ./
cd ../
zip -rq ../url-fixer.xpi *
cd ../

rm -rf .tmp_xpi_dir/
cp url-fixer.xpi ~/Desktop/

