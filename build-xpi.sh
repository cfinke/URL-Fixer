rm ~/Desktop/url-fixer.xpi
rm -rf .tmp_xpi_dir/
mkdir .tmp_xpi_dir/
cp -r url-fixer/* .tmp_xpi_dir/
rm -rf `find ./.tmp_xpi_dir/ -name ".DS_Store"`
rm -rf `find ./.tmp_xpi_dir/ -name "Thumbs.db"`
rm -rf `find ./.tmp_xpi_dir/ -name ".git"`
cd .tmp_xpi_dir/
zip -rq ~/Desktop/url-fixer.xpi *
cd ../
rm -rf .tmp_xpi_dir/