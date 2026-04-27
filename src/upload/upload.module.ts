import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { DuplicateCheckService } from './duplicate-check.service';
import { AssignmentSubmit } from '../assignment/entities/assignment-submit.entity';
import * as path from 'path';
import * as fs from 'fs';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssignmentSubmit]),
    MulterModule.register({
      storage: {
        _handleFile: (req, file, cb) => {
          const uploadsDir = path.join(process.cwd(), 'uploads');

          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          const filename = `img-${uniqueSuffix}${ext}`;
          const filepath = path.join(uploadsDir, filename);

          const outStream = fs.createWriteStream(filepath);

          file.stream.pipe(outStream);

          outStream.on('error', (err) => {
            cb(err);
          });

          outStream.on('finish', () => {
            cb(null, { path: filepath, filename });
          });
        },
        _removeFile: (req, file, cb) => {
          fs.unlink(file.path, (err) => {
            cb(err, !err);
          });
        },
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|bmp)$/)) {
          return cb(
            new Error('只支持图片格式：jpg, jpeg, png, gif, bmp'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, DuplicateCheckService],
  exports: [UploadService, DuplicateCheckService],
})
export class UploadModule {}
