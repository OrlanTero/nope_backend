import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminService } from './admin.service';
import { AdminListPostsDto } from './dto/admin-list-posts.dto';
import { AdminListUsersDto } from './dto/admin-list-users.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/summary')
  dashboardSummary() {
    return this.adminService.dashboardSummary();
  }

  @Get('users')
  listUsers(@Query() q: AdminListUsersDto) {
    return this.adminService.listUsers(q);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Get('vibes/posts')
  vibePosts(@Query() q: AdminListDto) {
    return this.adminService.vibePosts(q);
  }

  @Get('vibes/users')
  vibeUsers(@Query() q: AdminListDto) {
    return this.adminService.vibeUsers(q);
  }

  @Get('vibes/hashtags')
  vibeHashtags(@Query() q: AdminListDto) {
    return this.adminService.vibeHashtags(q);
  }

  @Get('content/posts')
  listPosts(@Query() q: AdminListPostsDto) {
    return this.adminService.listPosts(q);
  }

  @Delete('content/posts/:id')
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }
}
