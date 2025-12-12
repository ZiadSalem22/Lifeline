
const { format } = require('date-fns');

try {
    const invalidDate = new Date('2023-13-45T00:00:00');
    console.log('Date object:', invalidDate);
    console.log('Date string:', invalidDate.toString());

    // Attempt format
    const output = format(invalidDate, 'EEEE, MMMM d');
    console.log('Output:', output);
} catch (e) {
    console.error('Crash confirmed:', e.message);
    console.error('Error name:', e.name);
}
