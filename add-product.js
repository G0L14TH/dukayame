const db = require('./database/db');

async function addProduct() {
    try{
        const product = {
            name: '0VI2V202IV : GEM Z',
            description: '9 tracks + Lyrics + Cover Art + Media',
            price: 100,
            file_path: '20-MKS-ESSAY.zip',
            file_size: '100 MB',
            artist: 'derrick!',
            album: 'GEM Z',
            artwork_url: 'gemz.jpg',
        };

        await db.init();
        
        // add products
         const result = await db.run(`
      INSERT INTO products (name, description, price, file_path, file_size, artist, album, artwork_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [product.name, product.description, product.price, product.file_path, product.file_size, product.artist, product.album, product.artwork_url]);

    console.log('Product added successfully!');
    console.log('Product ID:', result.id);
    console.log('Name:', product.name);
    console.log('Price: Ksh', product.price);
    console.log('File:', product.file_path);

    process.exit(0);
    } catch (error) {
        console.error('ERROR ADDING PRODUCT');
        process.exit(1);
    }
}
addProduct();