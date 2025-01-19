import express from 'express';
import Reference from '../models/Reference.js'

// 에러 처리 핸들러
function asyncHandler(handler) {
    return async function (req, res) {
        try {
            await handler(req, res);
        } catch (e) {
            if (e.name === 'ValidationError') {
                res.status(400).send({ message: e.message });
            } else if (e.name === 'CastError') {
                res.status(404).send({ message: 'Cannot find given id.' });
            } else {
                res.status(500).send({ message: e.message });
            }
        }
    };
}

// 레퍼런스 추가
export const addReference = asyncHandler(async (req, res) => {
    const { category, title, keywords, memo, resources } = req.body;
    const newReference = new Reference({ category, title, keywords, memo, resources });
    await newReference.save();
    res.status(201).json({ message: '레퍼런스 추가 성공', reference: newReference });
});

// 레퍼런스 수정
export const updateReference = asyncHandler(async (req, res) => {
    const { category, title, keywords, memo, resources } = req.body;
    const updatedReference = await Reference.findByIdAndUpdate(
        req.params.referenceId,
        { category, title, keywords, memo, resources },
        { new: true }
    );
    if (!updatedReference) {
        return res.status(404).json({ message: '레퍼런스를 찾지 못하였습니다.' });
    }
    res.status(200).json({ message: '레퍼런스가 성공적으로 수정되었습니다.', reference: updatedReference });
});

// 레퍼런스 삭제
export const deleteReference = asyncHandler(async (req, res) => {
    try {
      const { referenceId } = req.params;
  
      const deletedReference = await Reference.findByIdAndDelete(referenceId);
  
      if (!deletedReference) {
        return res.status(404).json({ message: '레퍼런스를 찾지 못하였습니다.' });
      }
  
      res.status(200).json({
        message: '레퍼런스가 성공적으로 삭제되었습니다.',
        reference: deletedReference,
      });
    } catch (error) {
      res.status(500).json({ message: '레퍼런스 삭제 오류', error });
    }
  });
  