document.addEventListener('DOMContentLoaded', () => {
    console.log('Products page loaded');

    const addProductBtn = document.getElementById('addProductBtn');
    const productModal = document.getElementById('productModal');
    const modalContent = productModal.querySelector('.modal-content');
    const modalHeader = productModal.querySelector('.modal-header');
    const closeProductModal = document.getElementById('closeProductModal');
    const saveProductBtn = document.getElementById('saveProductBtn');
    const cancelProductBtn = document.getElementById('cancelProductBtn');
    const productTable = document.getElementById('productTable').getElementsByTagName('tbody')[0];
    const draggableContainer = document.getElementById('draggableContainer');

    // Improve modal styling
    if (productModal) {
        // Enhance modal appearance with better styling
        productModal.style.display = 'none';
        productModal.style.position = 'fixed';
        productModal.style.zIndex = '1000';
        productModal.style.left = '0';
        productModal.style.top = '0';
        productModal.style.width = '100%';
        productModal.style.height = '100%';
        productModal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        productModal.style.alignItems = 'center';
        productModal.style.justifyContent = 'center';
    }

    if (modalContent) {
        // Improve modal content styling
        modalContent.style.backgroundColor = '#fff';
        modalContent.style.borderRadius = '8px';
        modalContent.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        modalContent.style.padding = '20px';
        modalContent.style.width = '500px'; 
        modalContent.style.maxWidth = '90%';
        modalContent.style.position = 'relative';
        modalContent.style.overflow = 'hidden';
    }

    if (modalHeader) {
        // Improve header styling
        modalHeader.style.cursor = 'move';
        modalHeader.style.padding = '10px 15px';
        modalHeader.style.borderBottom = '1px solid #eee';
        modalHeader.style.marginBottom = '15px';
        modalHeader.style.display = 'flex';
        modalHeader.style.justifyContent = 'space-between';
        modalHeader.style.alignItems = 'center';
    }

    // Enhance buttons in modal
    const enhanceButton = (btn, isPrimary = false) => {
        if (btn) {
            btn.style.padding = '8px 16px';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.border = 'none';
            btn.style.marginLeft = '10px';
            
            if (isPrimary) {
                btn.style.backgroundColor = '#4CAF50';
                btn.style.color = 'white';
            } else {
                btn.style.backgroundColor = '#f1f1f1';
                btn.style.color = '#333';
            }
        }
    };

    enhanceButton(saveProductBtn, true);
    enhanceButton(cancelProductBtn);
    enhanceButton(closeProductModal);

    // Check if openingStock input exists and replace with Full and Empty inputs
    const openingStockInput = document.getElementById('productOpeningStock');
    if (openingStockInput) {
        // Get the parent element to replace the input
        const parentElement = openingStockInput.parentElement;
        
        // Create the opening stock container with label
        const stockContainer = document.createElement('div');
        stockContainer.style.marginBottom = '15px';
        
        // Add a heading for the stock section
        const stockHeading = document.createElement('div');
        stockHeading.textContent = 'Opening Stock';
        stockHeading.style.fontWeight = 'bold';
        stockHeading.style.marginBottom = '8px';
        stockContainer.appendChild(stockHeading);
        
        // Create Full Stock input with label
        const fullStockLabel = document.createElement('label');
        fullStockLabel.textContent = 'Full: ';
        fullStockLabel.style.display = 'inline-block';
        fullStockLabel.style.width = '80px';
        stockContainer.appendChild(fullStockLabel);
        
        const fullStockInput = document.createElement('input');
        fullStockInput.type = 'number';
        fullStockInput.id = 'productFullStock';
        fullStockInput.min = '0';
        fullStockInput.value = '0';
        fullStockInput.style.width = 'calc(100% - 90px)';
        fullStockInput.style.padding = '8px';
        fullStockInput.style.borderRadius = '4px';
        fullStockInput.style.border = '1px solid #ddd';
        fullStockInput.style.marginBottom = '10px';
        stockContainer.appendChild(fullStockInput);
        
        // Add a line break
        stockContainer.appendChild(document.createElement('br'));
        
        // Create Empty Stock input with label
        const emptyStockLabel = document.createElement('label');
        emptyStockLabel.textContent = 'Empty: ';
        emptyStockLabel.style.display = 'inline-block';
        emptyStockLabel.style.width = '80px';
        stockContainer.appendChild(emptyStockLabel);
        
        const emptyStockInput = document.createElement('input');
        emptyStockInput.type = 'number';
        emptyStockInput.id = 'productEmptyStock';
        emptyStockInput.min = '0';
        emptyStockInput.value = '0';
        emptyStockInput.style.width = 'calc(100% - 90px)';
        emptyStockInput.style.padding = '8px';
        emptyStockInput.style.borderRadius = '4px';
        emptyStockInput.style.border = '1px solid #ddd';
        stockContainer.appendChild(emptyStockInput);
        
        // Replace the original opening stock input with the new container
        if (parentElement) {
            parentElement.replaceChild(stockContainer, openingStockInput);
        }
    }

    // Style form inputs if they exist
    const inputs = productModal.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        if (input.id !== 'productFullStock' && input.id !== 'productEmptyStock') {
            input.style.width = '100%';
            input.style.padding = '8px';
            input.style.marginBottom = '15px';
            input.style.borderRadius = '4px';
            input.style.border = '1px solid #ddd';
            input.style.boxSizing = 'border-box';
        }
    });

    // Add footer with button container if it doesn't exist
    const modalFooter = productModal.querySelector('.modal-footer') || document.createElement('div');
    if (!productModal.querySelector('.modal-footer')) {
        modalFooter.className = 'modal-footer';
        modalFooter.style.display = 'flex';
        modalFooter.style.justifyContent = 'flex-end';
        modalFooter.style.marginTop = '20px';
        
        // Move buttons to footer if they're not already there
        if (saveProductBtn && saveProductBtn.parentNode !== modalFooter) {
            modalFooter.appendChild(saveProductBtn);
        }
        if (cancelProductBtn && cancelProductBtn.parentNode !== modalFooter) {
            modalFooter.appendChild(cancelProductBtn);
        }
        
        modalContent.appendChild(modalFooter);
    }

    let products = [];
    let editingProduct = null;

    // Main container dragging functionality
    let mainIsDragging = false;
    let mainStartX;
    let mainStartY;
    let mainScrollLeft;
    let mainScrollTop;

    draggableContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, a')) return;
        
        mainIsDragging = true;
        draggableContainer.classList.add('dragging');
        mainStartX = e.pageX - draggableContainer.offsetLeft;
        mainStartY = e.pageY - draggableContainer.offsetTop;
        mainScrollLeft = draggableContainer.scrollLeft;
        mainScrollTop = draggableContainer.scrollTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (!mainIsDragging) return;

        e.preventDefault();
        const x = e.pageX - draggableContainer.offsetLeft;
        const y = e.pageY - draggableContainer.offsetTop;
        const walkX = (x - mainStartX);
        const walkY = (y - mainStartY);
        draggableContainer.scrollLeft = mainScrollLeft - walkX;
        draggableContainer.scrollTop = mainScrollTop - walkY;
    });

    document.addEventListener('mouseup', () => {
        mainIsDragging = false;
        draggableContainer.classList.remove('dragging');
    });

    // Prevent drag on interactive elements
    const interactiveElements = draggableContainer.querySelectorAll('button, input, select, a');
    interactiveElements.forEach(element => {
        element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    });

    // Modal dragging functionality
    let modalIsDragging = false;
    let modalCurrentX;
    let modalCurrentY;
    let modalInitialX;
    let modalInitialY;
    let modalXOffset = 0;
    let modalYOffset = 0;

    modalHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        modalInitialX = e.clientX - modalXOffset;
        modalInitialY = e.clientY - modalYOffset;

        if (e.target === modalHeader || e.target.parentNode === modalHeader) {
            modalIsDragging = true;
            modalContent.classList.add('dragging');
        }
    }

    function drag(e) {
        if (modalIsDragging) {
            e.preventDefault();
            modalCurrentX = e.clientX - modalInitialX;
            modalCurrentY = e.clientY - modalInitialY;

            modalXOffset = modalCurrentX;
            modalYOffset = modalCurrentY;

            setTranslate(modalCurrentX, modalCurrentY, modalContent);
        }
    }

    function dragEnd(e) {
        modalInitialX = modalCurrentX;
        modalInitialY = modalCurrentY;
        modalIsDragging = false;
        modalContent.classList.remove('dragging');
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    // Reset modal position when opening
    function resetModalPosition() {
        modalXOffset = 0;
        modalYOffset = 0;
        modalContent.style.transform = 'translate(0px, 0px)';
    }

    // Load existing products when page loads
    loadProducts();

    function loadProducts() {
        fetch('/api/products')
            .then(response => response.json())
            .then(data => {
                products = data;
                renderProducts();
            })
            .catch(error => console.error('Error loading products:', error));
    }

    addProductBtn.addEventListener('click', () => {
        resetModalPosition();
        productModal.style.display = 'flex';
    });

    closeProductModal.addEventListener('click', () => {
        productModal.style.display = 'none';
        clearForm();
    });

    cancelProductBtn.addEventListener('click', () => {
        productModal.style.display = 'none';
        clearForm();
    });

    saveProductBtn.addEventListener('click', () => {
        const name = document.getElementById('productName').value;
        const description = document.getElementById('productDescription').value;
        const fullStock = parseInt(document.getElementById('productFullStock')?.value) || 0;
        const emptyStock = parseInt(document.getElementById('productEmptyStock')?.value) || 0;

        if (!name.trim() || !description.trim()) {
            alert('Please fill in both name and description');
            return;
        }

        // Check for duplicate product name
        const isDuplicate = editingProduct 
            ? products.some(p => p.id !== editingProduct.id && p.name.toLowerCase() === name.toLowerCase())
            : products.some(p => p.name.toLowerCase() === name.toLowerCase());
            
        if (isDuplicate) {
            alert(`A product with the name "${name}" already exists. Please use a different name.`);
            return;
        }

        const productData = { 
            name, 
            description, 
            fullStock, 
            emptyStock 
        };
        
        if (editingProduct) {
            // Update existing product
            fetch(`/api/products/${editingProduct.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            })
            .then(response => response.json())
            .then(() => {
                loadProducts(); // Reload all products
                clearForm();
                productModal.style.display = 'none';
            })
            .catch(error => console.error('Error updating product:', error));
        } else {
            // Create new product
            fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            })
            .then(response => response.json())
            .then((newProduct) => {
                // Add initial stock movement for the new product
                const stockMovementData = {
                    date: new Date().toISOString().split('T')[0],
                    productName: name,
                    filledStock: fullStock,
                    emptyStock: emptyStock,
                    filledReceived: fullStock,
                    filledSupplied: 0,
                    emptyReceived: emptyStock,
                    emptySupplied: 0
                };

                return fetch('/api/stock/movements', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(stockMovementData)
                });
            })
            .then(() => {
                loadProducts(); // Reload all products
                clearForm();
                productModal.style.display = 'none';
            })
            .catch(error => console.error('Error saving product:', error));
        }
    });

    // Update table header to include Full and Empty columns
    const updateTableHeader = () => {
        const headerRow = document.querySelector('#productTable thead tr');
        if (headerRow) {
            // Check if we need to update the header
            const headers = headerRow.querySelectorAll('th');
            const needsUpdate = headers.length === 4 && headers[2].textContent === 'Opening Stock';
            
            if (needsUpdate) {
                // Replace the "Opening Stock" header with "Full Stock" and add "Empty Stock"
                headers[2].textContent = 'Full Stock';
                
                // Create and insert the Empty Stock header
                const emptyHeader = document.createElement('th');
                emptyHeader.textContent = 'Empty Stock';
                headerRow.insertBefore(emptyHeader, headers[3]);
            }
        }
    };
    
    // Call this function when the page loads
    updateTableHeader();

    function renderProducts() {
        productTable.innerHTML = '';
        products.forEach(product => {
            const row = productTable.insertRow();
            row.insertCell(0).textContent = product.name;
            row.insertCell(1).textContent = product.description;
            row.insertCell(2).textContent = product.fullStock || 0;
            row.insertCell(3).textContent = product.emptyStock || 0;
            const actionsCell = row.insertCell(4);
            actionsCell.innerHTML = `
                <button onclick="editProduct(${product.id})">Edit</button>
                <button onclick="deleteProduct(${product.id})">Delete</button>
            `;
        });
    }

    window.editProduct = function(productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            editingProduct = product;
            document.getElementById('productName').value = product.name;
            document.getElementById('productDescription').value = product.description;
            document.getElementById('productFullStock').value = product.fullStock || 0;
            document.getElementById('productEmptyStock').value = product.emptyStock || 0;
            resetModalPosition();
            productModal.style.display = 'flex';
        }
    };

    window.deleteProduct = function(productId) {
        if (confirm('Are you sure you want to delete this product?')) {
            fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(() => {
                loadProducts(); // Reload all products
            })
            .catch(error => console.error('Error deleting product:', error));
        }
    };

    function clearForm() {
        document.getElementById('productName').value = '';
        document.getElementById('productDescription').value = '';
        document.getElementById('productFullStock').value = '0';
        document.getElementById('productEmptyStock').value = '0';
        editingProduct = null;
    }

    // Enhanced table styling 
    const productDataTable = document.getElementById('productTable');
    if (productDataTable) {
        productDataTable.style.width = '100%';
        productDataTable.style.borderCollapse = 'collapse';
        productDataTable.style.marginTop = '20px';
        
        const tableHeaders = productDataTable.querySelectorAll('th');
        tableHeaders.forEach(header => {
            header.style.backgroundColor = '#f8f9fa';
            header.style.padding = '10px';
            header.style.borderBottom = '2px solid #dee2e6';
            header.style.textAlign = 'left';
        });
        
        const tableCells = productDataTable.querySelectorAll('td');
        tableCells.forEach(cell => {
            cell.style.padding = '8px 10px';
            cell.style.borderBottom = '1px solid #dee2e6';
        });
        
        // Add hover effect to rows
        const tableRows = productDataTable.querySelectorAll('tbody tr');
        tableRows.forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = '#f1f1f1';
            });
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
            });
        });
    }
});