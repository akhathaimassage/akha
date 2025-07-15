#!/bin/bash

# --- ทำให้สคริปต์หยุดทำงานทันทีถ้ามีคำสั่งไหนผิดพลาด ---
set -e

# --- ตรวจสอบว่าอยู่ใน Git repository หรือไม่ ---
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "❌ Error: ไม่ได้อยู่ใน Git repository"
    exit 1
fi

# --- แสดงสถานะของ Git ก่อน ---
echo "--- 🔎 สถานะไฟล์ปัจจุบัน ---"
git status
echo "--------------------------"
echo ""

# --- ถามเพื่อยืนยันการทำงานต่อ ---
read -p "ต้องการดำเนินการต่อหรือไม่? (y/n): " confirm
if [[ "$confirm" != "y" ]]; then
    echo "🚫 ยกเลิกการทำงาน"
    exit 0
fi
echo ""

# --- ถามหาข้อความสำหรับ Commit ---
read -p "📝 กรุณาใส่ Commit Message: " COMMIT_MESSAGE

# --- ตรวจสอบว่า Commit Message ไม่ใช่ค่าว่าง ---
if [ -z "$COMMIT_MESSAGE" ]; then
    echo "❌ Error: Commit message ห้ามเป็นค่าว่าง"
    exit 1
fi

# --- เริ่มกระบวนการ Git ---
echo ""
echo "🚀 เริ่มกระบวนการอัปเดตโค้ด..."

# 1. Add ไฟล์ทั้งหมดที่เปลี่ยนแปลง
echo "Step 1: กำลัง Add ไฟล์ทั้งหมด..."
git add .
echo "✅ Add ไฟล์เรียบร้อย"

# 2. Commit ไฟล์ด้วยข้อความที่รับมา
echo "Step 2: กำลัง Commit โค้ด..."
git commit -m "$COMMIT_MESSAGE"
echo "✅ Commit เรียบร้อย"

# 3. Push โค้ดขึ้นไปยัง Remote Repository (origin) บน Branch ปัจจุบัน
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Step 3: กำลัง Push โค้ดไปยัง Branch '$CURRENT_BRANCH'..."
git push origin $CURRENT_BRANCH
echo "✅ Push เรียบร้อย"

echo ""
echo "🎉 อัปเดตโค้ด Frontend ของคุณขึ้น Git สำเร็จ!"