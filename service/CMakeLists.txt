cmake_minimum_required(VERSION 3.14)
project(focus_guard_service CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(focus_guard_service focus_guard_service.cpp)

if(WIN32)
  target_link_libraries(focus_guard_service advapi32)
  # Embed manifest for requireAdministrator
  set_target_properties(focus_guard_service PROPERTIES
    LINK_FLAGS "/MANIFESTUAC:\"level='requireAdministrator' uiAccess='false'\"")
endif()

target_compile_options(focus_guard_service PRIVATE
  $<$<CXX_COMPILER_ID:MSVC>:/W4>
  $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall -Wextra -O2>
)
