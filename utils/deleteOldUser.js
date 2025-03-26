import User from '../models/User.js';

const deleteOldUsers = async () => {
  console.log('🛠️ 7일이 지난 탈퇴 요청 계정을 삭제하는 작업을 시작합니다.');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // 삭제 대상 계정 조회
    const usersToDelete = await User.find({ 
      deleteRequestDate: { $lte: sevenDaysAgo }
    });

    // 삭제 대상 계정 정보 조회
    console.log('🛠️ 삭제된 계정 목록:');
    usersToDelete.forEach(user => {
      console.log(`이름: ${user.name}, 이메일: ${user.email}`);
    });

    // 계정 삭제
    const deletedUsers = await User.deleteMany({ 
      deleteRequestDate: { $lte: sevenDaysAgo }
    });

    console.log(`🛠️ 삭제된 계정 수: ${deletedUsers.deletedCount}`);
  } catch (error) {
    console.error('7일이 지난 탈퇴 요청 계정 삭제 중 오류가 발생했습니다.:', error);
  } finally {
    process.exit(0);
  }
};

deleteOldUsers();