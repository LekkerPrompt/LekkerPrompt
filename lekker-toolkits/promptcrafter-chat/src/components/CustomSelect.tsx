import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false,
  'aria-label': ariaLabel,
  title
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number; 
    left: number; 
    width: number;
    maxHeight: number;
    openUpward: boolean;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  
  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  const calculatePosition = () => {
    if (!buttonRef.current) return null;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Estimate dropdown height (40px per option + padding)
    const estimatedDropdownHeight = options.length * 40 + 16;
    
    // Check space below
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    
    // Decide whether to open upward or downward
    const openUpward = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;
    
    // Calculate available height
    const maxHeight = Math.min(
      estimatedDropdownHeight,
      openUpward ? spaceAbove : spaceBelow,
      300 // Maximum dropdown height
    );
    
    // Calculate horizontal position
    let left = rect.left;
    const dropdownWidth = rect.width;
    
    // Ensure dropdown doesn't overflow viewport horizontally
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }
    
    return {
      top: openUpward ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left,
      width: dropdownWidth,
      maxHeight,
      openUpward
    };
  };

  const toggleDropdown = () => {
    if (disabled) return;
    
    if (!isOpen) {
      const position = calculatePosition();
      setDropdownPos(position);
    }
    setIsOpen(!isOpen);
  };

  const selectOption = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Don't close if clicking on the trigger button
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking on the dropdown itself
      if (target.closest('.menu-panel')) {
        return;
      }
      
      // Close the dropdown
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape and reposition on window events
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleWindowResize = () => {
      if (isOpen) {
        // Recalculate position on window resize/scroll
        const position = calculatePosition();
        setDropdownPos(position);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('resize', handleWindowResize);
      window.addEventListener('scroll', handleWindowResize, true);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        window.removeEventListener('resize', handleWindowResize);
        window.removeEventListener('scroll', handleWindowResize, true);
      };
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleDropdown();
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={title}
        className={`
          w-full text-left flex items-center justify-between
          rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-gray-200
          transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        <span className={selectedOption ? "text-gray-200" : "text-gray-400"}>
          {displayText}
        </span>
        <svg 
          className={`ml-2 h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          viewBox="0 0 20 20" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          role="menu"
          className={`menu-panel fixed z-[10001] overflow-y-auto ${
            dropdownPos.openUpward ? 'animate-in slide-in-from-bottom-2' : 'animate-in slide-in-from-top-2'
          }`}
          style={{ 
            top: dropdownPos.top, 
            left: dropdownPos.left, 
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!option.disabled) {
                  selectOption(option.value);
                }
              }}
              className={`
                menu-item text-left block w-full
                ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${option.value === value ? 'bg-gray-700' : ''}
              `}
              role="menuitem"
              disabled={option.disabled}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
