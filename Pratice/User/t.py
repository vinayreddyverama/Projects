#importing the text file or give me option to input the data
input_file = 'Projects/user/customer.csv'

# Reading the file
with open(input_file, 'r') as file:
    data = file.read()
    
#Give me just header of the data
print("\nHeader of the data:")
header = data.splitlines()[0]
print(header)   

# Display the data top 5 rows
print("\nTop 5 rows of the data:")
data_lines = data.splitlines()
# Display the first 5 lines
for line in data_lines[0:5]:
    print(line)

#Convert the data all data to lower case
data_lines = [line.lower() for line in data_lines]

# Generating unique identifier for each row without using pandas
import uuid
# Generate a unique identifier for each row
unique_ids = [str(uuid.uuid4()) for _ in range(len(data_lines) - 1)]
# Display the unique identifiers with the top 5 rows
print("\nUnique identifiers with the top 3 rows:")
for i, line in enumerate(data_lines[:4]):
    print(f"{unique_ids[i]}: {line}")
    
'''#Give me output based on input by giving me option to choose based on the header
print("\nChoose an option based on the header:")
options = header.split(',')
for i, option in enumerate(options):
    print(f"{i + 1}: {option}")
choice = int(input("Enter the option number: "))
# Display the chosen option
print(f"You chose: {options[choice - 1]}")

# Using above input to filter the data and give me option to enter the value
value = input("Enter the value in lowercase to filter the data:")
# Filter the data based on the chosen option and value
filtered_data = []
for line in data_lines[1:]:
    if value in line:
        filtered_data.append(line)
# Display the filtered data
print("Filtered data:")
for line in filtered_data:
    print(line)
'''

# rewriting above code that takes option to choose based on the header then enter the value to get output
print("\nChoose a column to filter by:")
options = header.split(',')
for i, option in enumerate(options):
    print(f"{i + 1}: {option.strip()}")
    
choice = int(input("Enter the option number: "))
column_index = choice - 1
selected_column = options[column_index].strip()
value = input(f"Enter the value for {selected_column} in lowercase for text: ")
print("Filtered results:")
for line in data_lines[1:]:        
    fields = line.split(',')
    if len(fields) > column_index and fields[column_index].strip() == value:
        print(line)