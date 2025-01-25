import mongoose from 'mongoose';

const mongoURL = 'mongodb+srv://tory2174:dlwjdals@cluster0.5baifmu.mongodb.net/ref-hub?retryWrites=true&w=majority&appName=Cluster0'; // 연결할 데이터베이스 URL
mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    process.exit(0); // 연결 성공 시 종료
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1); // 연결 실패 시 종료
  });
