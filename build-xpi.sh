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

rm -rf ~/Library/Application\ Support/Fennec/Profiles/uh6wew3f.default/extensions/\{0fa2149e-bb2c-4ac2-a8d3-479599819475\}/*
cp -r .tmp_xpi_dir/* ~/Library/Application\ Support/Fennec/Profiles/uh6wew3f.default/extensions/\{0fa2149e-bb2c-4ac2-a8d3-479599819475\}/

rm -rf .tmp_xpi_dir/
cp url-fixer.xpi ~/Desktop/

