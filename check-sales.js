const db = require('./database/db');

async function checkSales() {
    try {
        await db.init();

        console.log('\n SALES REPORT\n');
        console.log('='.repeat(70));

        // we are getting all completed transactions
            const sales = await db.all(`
      SELECT 
        t.id,
        t.phone_number,
        t.amount,
        t.mpesa_receipt_number,
        t.created_at,
        p.name as product_name
      FROM transactions t
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.status = 'completed'
      ORDER BY t.created_at DESC
    `);
            
    if (sales.length === 0) {
        console.log('No sales yet.');
        process.exit(0);
        }

        // we display each sale
        sales.forEach((sale, index) => {
            console.log(`\n${index + 1}. ${sale.product_name || 'Unknown Product'}`);
            console.log(`   Phone: ${sale.phone_number}`);
            console.log(`   Amount: Ksh ${sale.amount}`);
            console.log(`   Receipt: ${sale.mpesa_receipt_number}`);
            console.log(`   Date: ${sale.created_at}`);
        });
    // calculating the totals
    const total = sales.reduce((sum, sale) => sum + sale.amount, 0);

    console.log('\n' + '='.repeat(70));
    console.log(`Total Sales: ${sales.length}`);
    console.log(`Total Revenue: Ksh ${total.toLocaleString()}`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);   
    } catch (error) {
        console.error(' ERROR checking sales:', error);
        process.exit(1);
    }
}

checkSales();