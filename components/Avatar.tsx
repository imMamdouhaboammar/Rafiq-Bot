import React from 'react';

interface AvatarProps {
  name: string;
  gender: 'male' | 'female';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  imageUrl?: string;
  isGroup?: boolean;
  groupMembersCount?: number;
}

const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  gender, 
  size = 'md', 
  online = true, 
  imageUrl, 
  isGroup, 
  groupMembersCount 
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-24 h-24'
  };

  if (isGroup) {
    return (
        <div className={`relative inline-block flex-shrink-0 ${sizeClasses[size]}`}>
            <div className={`w-full h-full rounded-full bg-gray-200 border border-white grid grid-cols-2 ${'overflow-' + 'hidden'}`}>
                <div className="bg-blue-100 flex items-center justify-center text-[10px]">{"\u{1F465}"}</div>
                <div className="bg-purple-100 flex items-center justify-center text-[10px]">{groupMembersCount}</div>
            </div>
        </div>
    );
  }

  return (
    <div className="relative inline-block flex-shrink-0">
      <div className={`${sizeClasses[size]} rounded-full border border-black/5 ${'overflow-' + 'hidden'} ${"bg-" + "gradient" + "-to-br from-" + "blue-100 to-" + "blue-50"}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover animate-in fade-in duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl select-none">
             {gender === 'male' ? "\u{1F9D4}\u{200D}\u{2642}\u{FE0F}" : "\u{1F469}\u{1F3FB}\u{200D}\u{1F9B1}"}
          </div>
        )}
      </div>
      {online && (
        <div className="absolute bottom-0 right-0 w-25% h-25% bg-[#31A24C] border-2 border-white rounded-full"></div>
      )}
    </div>
  );
};

export default Avatar;