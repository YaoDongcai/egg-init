#coding=utf-8
import shutil
import datetime
import os
starttime = datetime.datetime.now();
print(starttime)
# 先要遍历文件夹底下的所有文件
# path 为需要拷贝的文件目录系统
# out 为需要输出的文件目录
def moveFileByPath(path, out):
    # 遍历文件夹后 找到 里面的所以文件
    for files in os.listdir(path):
        name = os.path.join(path, files)
        # 这个里面最好是加一个新的名称 利用时间戳开始弄这个即可
        back_name = os.path.join(out, files)
        # 判断当前的name 是否为指定的文件
        if os.path.isfile(name):
            # 如果是那么就需要move 剪切即可
            shutil.move(name, back_name);
        else:
            pase;

# 需要拷贝的文件区域
def changeFileName(newFileName):
    # 利用时间戳来改变文件的名称
    return datetime.datetime.now() + newFileName;

sourceURL = u"/home/pi/Pictures/dog.jpg";

# USB的文件目录列表
destination = u"/media/pi/3266-3435/"
try:
    # copy file and delete 原来的文件目录 并且需要保持原先的目录结构不变的
    # 移动文件 同时命名为新的文件名称
    moveFileByPath(sourceURL, destination);
    # shutil.move(sourceURL, destination)
except shutil.Error as e:
    print("Error: %s" % e);
except IOError as e:
    print("Error: %s" % e);
endtime = datetime.datetime.now();
print(endtime)
print (endtime - starttime).seconds;