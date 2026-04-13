const db = require('./database/db');

async function dailySales() {
    try {
        await db.init();
        
        // get today's date
        const today = new Date().toDateString().split('T')[0]; 

        console.log(`\n SALES FOR ${today}`);
        console.log("=".repeat(70));

        const sales = await db.all(`
            SELECT
            COUNT(*) as count,
            SUM(amount) as total,
            AVG(amount) as average
            FROM transactions
            WHERE status = 'completed'
            AND DATE(created_at) = ?
            [today]`);
        
            const todaySales = sales[0];

            if(todaySales.count === 0){
                console.log('No sales today yet.');
            } else {
                console.log(`Sales Today: ${todaySales.count}`);
                console.log(`Total Revenue: Ksh ${todaySales.total.toLocaleString()}`);
                console.log(`Average Order: Ksh ${Math.round(todaySales.average)}`);
            }
        console.log('='.repeat(70) + '\n');

        process.exit(0);
    } catch(error) {
        console.log('ERROR:'.error);
        process.exit(1);
    }   
}
dailySales();